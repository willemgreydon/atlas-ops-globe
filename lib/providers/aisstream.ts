import type { VesselRow } from "@/stores/app-store";

/**
 * AISStream.io — free real-time global AIS vessel positions over a WebSocket.
 * https://aisstream.io/documentation
 *
 * AIS is a stream, not a request, so we open a short-lived socket, collect
 * position reports for a few seconds (deduping by MMSI), then close and return a
 * snapshot. The maritime route caches this so we open at most one socket per TTL
 * window per warm instance. Live from Vercel, no vault — which is what fills the
 * previously-empty Maritime layer worldwide (incl. RU/CN/AF coasts). Needs
 * AISSTREAM_API_KEY.
 */

export function aisConfigured(): boolean {
  return !!process.env.AISSTREAM_API_KEY;
}

const NAV_STATUS: Record<number, string> = {
  0: "under way (engine)", 1: "at anchor", 2: "not under command", 3: "restricted manoeuvrability",
  4: "constrained by draught", 5: "moored", 6: "aground", 7: "fishing", 8: "under way (sailing)",
};

interface AisMessage {
  MetaData?: { MMSI?: number | string; ShipName?: string; latitude?: number; longitude?: number };
  Message?: { PositionReport?: { Sog?: number; Cog?: number; NavigationalStatus?: number } };
}

/** Pure mapper: one decoded AISStream PositionReport → a VesselRow (or null). */
export function messageToVessel(m: AisMessage, nowIso: string): VesselRow | null {
  const md = m.MetaData;
  if (!md || typeof md.latitude !== "number" || typeof md.longitude !== "number" || md.MMSI == null) return null;
  const mmsi = String(md.MMSI);
  const pr = m.Message?.PositionReport;
  return {
    id: `vessel:${mmsi}`,
    mmsi,
    name: (md.ShipName ?? "").trim() || undefined,
    lat: md.latitude,
    lon: md.longitude,
    speedKn: typeof pr?.Sog === "number" ? pr.Sog : null,
    courseDeg: typeof pr?.Cog === "number" ? pr.Cog : null,
    navigationStatus: pr?.NavigationalStatus != null ? NAV_STATUS[pr.NavigationalStatus] : undefined,
    // The report is live (just transmitted), so the collection moment is its age.
    lastContact: nowIso,
  };
}

/** Open a socket, collect position reports for `collectMs`, return a snapshot. */
export function fetchAisSnapshot(collectMs = 5000, cap = 1500): Promise<VesselRow[]> {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) return Promise.reject(new Error("AISSTREAM_API_KEY not set"));

  return new Promise<VesselRow[]>((resolve, reject) => {
    const vessels = new Map<string, VesselRow>();
    const decoder = new TextDecoder();
    const nowIso = new Date().toISOString();
    let settled = false;
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    ws.binaryType = "arraybuffer";

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closing */ }
      resolve([...vessels.values()].slice(0, cap));
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    const timer = setTimeout(finish, collectMs);

    ws.onopen = () =>
      ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: [[[-90, -180], [90, 180]]], FilterMessageTypes: ["PositionReport"] }));
    ws.onmessage = (e: MessageEvent) => {
      try {
        const text = typeof e.data === "string" ? e.data : decoder.decode(e.data as ArrayBuffer);
        const v = messageToVessel(JSON.parse(text) as AisMessage, nowIso);
        if (v) vessels.set(v.mmsi!, v);
        if (vessels.size >= cap) finish();
      } catch { /* skip malformed frame */ }
    };
    ws.onerror = () => fail(new Error("aisstream websocket error"));
    ws.onclose = () => finish();
  });
}
