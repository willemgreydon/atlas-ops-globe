import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";
import { prov } from "@/lib/intel/provenance";
import { resolveCountry } from "@/lib/intel/resolve";
import { isValidPoint } from "@/lib/core/geo";
import type { Severity } from "@/types/domain";
import type { VaultEvent } from "@/lib/intel/schemas";

/**
 * ACLED — Armed Conflict Location & Event Data (political violence, protests,
 * strategic developments). https://acleddata.com/api-documentation/getting-started
 *
 * Auth is OAuth2 *password grant*: POST username(email)+password with the
 * hard-coded client_id="acled", grant_type="password", scope="authenticated".
 * We cache the 24h access token in memory and re-authenticate on expiry.
 * Credential-gated: without ACLED_USERNAME/ACLED_PASSWORD the domain is OFFLINE.
 */
const TOKEN_URL = "https://acleddata.com/oauth/token";
const API_URL = "https://acleddata.com/api/acled/read";

let cachedToken: { token: string; expiresAt: number } | null = null;

export function acledConfigured(): boolean {
  return !!(process.env.ACLED_USERNAME && process.env.ACLED_PASSWORD);
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const username = process.env.ACLED_USERNAME;
  const password = process.env.ACLED_PASSWORD;
  if (!username || !password) throw new Error("ACLED_USERNAME/ACLED_PASSWORD not set");
  const body = new URLSearchParams({
    username, password, grant_type: "password", client_id: "acled", scope: "authenticated",
  });
  const json = await fetchJson<{ access_token: string; expires_in?: number }>(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    timeoutMs: 20_000,
  });
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 86400) * 1000 };
  return cachedToken.token;
}

const RowSchema = z.object({
  event_id_cnty: z.string(),
  event_date: z.string(),
  disorder_type: z.string().optional(),
  event_type: z.string().optional(),
  sub_event_type: z.string().optional(),
  actor1: z.string().optional(),
  actor2: z.string().optional(),
  country: z.string().optional(),
  location: z.string().optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  fatalities: z.union([z.string(), z.number()]).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});
const ResponseSchema = z.object({
  status: z.number().optional(),
  success: z.boolean().optional(),
  count: z.number().optional(),
  data: z.array(RowSchema).default([]),
});

const num = (v: string | number | undefined): number | undefined => {
  if (v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Neutral severity from reported fatalities + ACLED's own disorder type. */
function severityFor(fatalities: number, disorderType?: string, eventType?: string): Severity {
  if (fatalities >= 10) return "critical";
  if (fatalities >= 1) return "warning";
  if (disorderType === "Political violence" || eventType === "Battles" || eventType === "Explosions/Remote violence") return "warning";
  return "watch";
}

/** Exported for fixture-based tests (no network). */
export function normalizeAcled(raw: unknown): VaultEvent[] {
  const parsed = ResponseSchema.parse(raw);
  return parsed.data.flatMap((r) => {
    const lat = num(r.latitude);
    const lon = num(r.longitude);
    if (!isValidPoint({ lat: lat ?? NaN, lon: lon ?? NaN })) return [];
    const fatalities = num(r.fatalities) ?? 0;
    const iso2 = resolveCountry(r.country)?.iso2;
    const observedAt = new Date(`${r.event_date}T00:00:00Z`).toISOString();
    const label = r.sub_event_type || r.event_type || "Event";
    const actors = [r.actor1, r.actor2].filter((a): a is string => !!a && a.trim().length > 0);
    return [
      {
        id: `event:acled:${r.event_id_cnty}`,
        kind: "conflict",
        subtype: r.sub_event_type,
        title: `${label}${r.location ? ` — ${r.location}` : ""}${r.country ? `, ${r.country}` : ""}`,
        summary: r.notes ? r.notes.slice(0, 400) : undefined,
        severity: severityFor(fatalities, r.disorder_type, r.event_type),
        occurredAt: observedAt,
        lat: lat!,
        lon: lon!,
        countryCode: iso2,
        source: r.source ? `ACLED · ${r.source}` : "ACLED",
        confidence: 0.85, // authoritative, human-coded dataset
        tags: [r.event_type, r.disorder_type, ...actors, fatalities > 0 ? `${fatalities} fatalities` : undefined]
          .filter((t): t is string => !!t),
        provenance: [
          prov({
            provider: "acled",
            dataset: "acled/read",
            providerRecordId: r.event_id_cnty,
            sourceUrl: "https://acleddata.com/",
            observedAt,
            license: "ACLED licence — attribution required, redistribution restricted",
            attribution: "ACLED (acleddata.com)",
          }),
        ],
      } satisfies VaultEvent,
    ];
  });
}

export async function fetchAcledEvents(opts: { days?: number; limit?: number } = {}): Promise<VaultEvent[]> {
  const token = await getAccessToken();
  const days = opts.days ?? 14;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const qs = new URLSearchParams({
    _format: "json",
    event_date: `${fmt(from)}|${fmt(to)}`,
    event_date_where: "BETWEEN",
    fields: "event_id_cnty|event_date|disorder_type|event_type|sub_event_type|actor1|actor2|country|iso|location|latitude|longitude|fatalities|source|notes",
    limit: String(opts.limit ?? 800),
  });
  const raw = await fetchJson<unknown>(`${API_URL}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 30_000,
    retries: 2, // conflict sync runs in CI with ample budget; ride out transient blips
  });
  return normalizeAcled(raw);
}
