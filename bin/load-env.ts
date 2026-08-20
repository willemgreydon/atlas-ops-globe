/**
 * Side-effect module: load `.env.local` then `.env` into process.env for the
 * CLI, mirroring how Next.js auto-loads them for the app. Imported first in
 * bin/intel.ts so credentials (e.g. MARINETRAFFIC_API_KEY, NVD_API_KEY) are
 * present before any other module evaluates. No-ops if the files are absent.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* file not present — ignore */
  }
}
