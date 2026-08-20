// ICAO airline designators → operator name. The first 3 letters of an ADS-B
// callsign are the operator's ICAO code (e.g. "DLH2AB" → Lufthansa). Curated
// common set for aircraft enrichment; extend as needed. Public reference data.
export const AIRLINES_ICAO: Record<string, string> = {
  DLH: "Lufthansa", BAW: "British Airways", AFR: "Air France", KLM: "KLM",
  UAL: "United Airlines", AAL: "American Airlines", DAL: "Delta Air Lines",
  SWA: "Southwest Airlines", JBU: "JetBlue", ACA: "Air Canada", RYR: "Ryanair",
  EZY: "easyJet", WZZ: "Wizz Air", VLG: "Vueling", EIN: "Aer Lingus",
  UAE: "Emirates", ETD: "Etihad Airways", QTR: "Qatar Airways", THY: "Turkish Airlines",
  SIA: "Singapore Airlines", CPA: "Cathay Pacific", ANA: "All Nippon Airways",
  JAL: "Japan Airlines", KAL: "Korean Air", AAR: "Asiana Airlines", CCA: "Air China",
  CES: "China Eastern", CSN: "China Southern", QFA: "Qantas", ANZ: "Air New Zealand",
  IBE: "Iberia", TAP: "TAP Air Portugal", SWR: "Swiss", AUA: "Austrian Airlines",
  SAS: "SAS", FIN: "Finnair", LOT: "LOT Polish Airlines", CSA: "Czech Airlines",
  AEE: "Aegean Airlines", ELY: "El Al", SVA: "Saudia", MEA: "Middle East Airlines",
  ETH: "Ethiopian Airlines", MSR: "EgyptAir", RAM: "Royal Air Maroc", KQA: "Kenya Airways",
  SAA: "South African Airways", AVA: "Avianca", LAN: "LATAM", GLO: "Gol", AZU: "Azul",
  AMX: "Aeroméxico", CMP: "Copa Airlines", THA: "Thai Airways", MAS: "Malaysia Airlines",
  GIA: "Garuda Indonesia", PAL: "Philippine Airlines", VIR: "Virgin Atlantic",
  DLH2: "Lufthansa", WJA: "WestJet", NKS: "Spirit Airlines", FFT: "Frontier",
  UPS: "UPS Airlines", FDX: "FedEx Express", GEC: "Lufthansa Cargo", CLX: "Cargolux",
  ABW: "AirBridgeCargo", BOX: "AeroLogic", ICE: "Icelandair", NAX: "Norwegian",
  TVF: "Transavia France", EWG: "Eurowings", CFG: "Condor", TUI: "TUI fly",
};

/** Derive operator from a callsign's leading 3-letter ICAO code. */
export function operatorFromCallsign(callsign?: string): string | undefined {
  if (!callsign) return undefined;
  const code = callsign.trim().slice(0, 3).toUpperCase();
  return AIRLINES_ICAO[code];
}
