import { z } from "zod";
import { tleToSpaceObject } from "./tle";
import type { VaultSpaceObject } from "@/lib/intel/schemas";

/**
 * Space-Track.org — the authoritative US Space Force catalogue (full GP/TLE set).
 * https://www.space-track.org/documentation
 *
 * Auth is cookie-based: POST identity+password to /ajaxauth/login, then reuse
 * the session cookie for the query. Space-Track enforces strict rate limits, so
 * we do a single bounded query per sync. Credential-gated by
 * SPACE_TRACK_USERNAME / SPACE_TRACK_PASSWORD.
 */
const LOGIN_URL = "https://www.space-track.org/ajaxauth/login";
const BASE = "https://www.space-track.org/basicspacedata/query";

export function spaceTrackConfigured(): boolean {
  return !!(process.env.SPACE_TRACK_USERNAME && process.env.SPACE_TRACK_PASSWORD);
}

// Space-Track returns null for many fields; be lenient and filter later.
const nstr = z.string().nullable().optional();
const GpSchema = z.array(
  z.object({
    OBJECT_NAME: nstr,
    OBJECT_ID: nstr,
    NORAD_CAT_ID: z.union([z.string(), z.number()]).nullable().optional(),
    OBJECT_TYPE: nstr,
    COUNTRY_CODE: nstr,
    LAUNCH_DATE: nstr,
    TLE_LINE1: nstr,
    TLE_LINE2: nstr,
  }),
);

async function login(): Promise<string> {
  const identity = process.env.SPACE_TRACK_USERNAME!;
  const password = process.env.SPACE_TRACK_PASSWORD!;
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "atlas-ops-globe/0.1" },
    body: new URLSearchParams({ identity, password }).toString(),
  });
  if (!res.ok) throw new Error(`Space-Track login ${res.status}`);
  const cookies = res.headers.getSetCookie?.() ?? [];
  const jar = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!jar) throw new Error("Space-Track login returned no session cookie");
  return jar;
}

export async function fetchSpaceTrack(limit = 1200): Promise<VaultSpaceObject[]> {
  if (!spaceTrackConfigured()) throw new Error("SPACE_TRACK_USERNAME/SPACE_TRACK_PASSWORD not set");
  const cookie = await login();
  // On-orbit PAYLOADS (real satellites, not debris/rocket bodies) with a recent
  // element set, catalogue order (established objects like ISS/GPS/Starlink first).
  const url = `${BASE}/class/gp/decay_date/null-val/object_type/PAYLOAD/epoch/%3Enow-30/orderby/norad_cat_id%20asc/limit/${limit}/format/json`;
  const res = await fetch(url, { headers: { cookie, "user-agent": "atlas-ops-globe/0.1" } });
  if (!res.ok) throw new Error(`Space-Track query ${res.status}`);
  const rows = GpSchema.parse(await res.json());
  return rows.flatMap((r) => {
    if (!r.TLE_LINE1 || !r.TLE_LINE2) return [];
    const obj = tleToSpaceObject(r.TLE_LINE1, r.TLE_LINE2, {
      name: r.OBJECT_NAME ?? "",
      cospar: r.OBJECT_ID ?? undefined,
      country: r.COUNTRY_CODE ?? undefined,
      objectType: r.OBJECT_TYPE ?? undefined,
      launchDate: r.LAUNCH_DATE ?? undefined,
      source: "spacetrack",
      dataset: "gp",
    });
    return obj ? [obj] : [];
  });
}
