import { prov } from "@/lib/intel/provenance";
import { stableId } from "@/lib/core/id";
import type { VaultSanction } from "@/lib/intel/schemas";

/**
 * OFAC — U.S. Treasury Specially Designated Nationals (SDN) list. Public,
 * free, US-Government data. https://ofac.treasury.gov/
 *
 * We load the SDN list as a reference dataset. IMPORTANT discipline: this is
 * NOT a matching engine — we never assert a person/vessel is sanctioned by name
 * similarity. Downstream matching must use hard identifiers (IMO, MMSI, aircraft
 * registration, LEI, passport) and preserve confidence/ambiguity.
 */
const SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv";

/** SDN_Type → canonical subject type. `-0-`/blank = an entity (organization). */
function subjectType(t: string): VaultSanction["subjectType"] {
  const v = t.trim().toLowerCase();
  if (v === "individual") return "person";
  if (v === "vessel") return "vessel";
  if (v === "aircraft") return "aircraft";
  return "entity";
}

const clean = (v: string | undefined): string | undefined => {
  const t = (v ?? "").trim();
  return t === "" || t === "-0-" ? undefined : t;
};

/**
 * Minimal RFC-4180 CSV parser: handles quoted fields with embedded commas,
 * quotes ("") and newlines — the SDN Remarks column contains all three.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Columns per the OFAC SDN.CSV spec (no header row). */
export function normalizeSdn(csv: string): VaultSanction[] {
  const rows = parseCsv(csv);
  const out: VaultSanction[] = [];
  for (const r of rows) {
    if (r.length < 4) continue;
    const [entNum, name, sdnType, program, , callSign, , , , vessFlag, vessOwner, remarks] = r;
    const cleanName = clean(name);
    if (!clean(entNum) || !cleanName) continue;
    const identifiers: Record<string, string> = {};
    if (clean(callSign)) identifiers.callSign = clean(callSign)!;
    if (clean(vessFlag)) identifiers.vesselFlag = clean(vessFlag)!;
    if (clean(vessOwner)) identifiers.vesselOwner = clean(vessOwner)!;
    out.push({
      id: stableId("sanction", "ofac", entNum),
      subjectType: subjectType(sdnType ?? ""),
      name: cleanName,
      aliases: [],
      program: clean(program),
      authority: "OFAC",
      jurisdiction: "US",
      identifiers,
      remarks: clean(remarks),
      source: "OFAC SDN",
      provenance: [
        prov({
          provider: "ofac",
          dataset: "sdn",
          providerRecordId: entNum.trim(),
          sourceUrl: "https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists",
          license: "US Government open data",
          attribution: "U.S. Treasury OFAC",
        }),
      ],
    });
  }
  return out;
}

export async function fetchOfacSdn(): Promise<VaultSanction[]> {
  const res = await fetch(SDN_URL, { headers: { "user-agent": "atlas-ops-globe/0.1" } });
  if (!res.ok) throw new Error(`OFAC SDN ${res.status}`);
  return normalizeSdn(await res.text());
}
