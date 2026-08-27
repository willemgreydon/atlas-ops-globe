import type { NextConfig } from "next";

// Next.js 16 uses Turbopack by default. Cesium ships prebuilt worker/asset
// bundles that we copy into /public/cesium via scripts/copy-cesium.mjs, so no
// custom bundler rules are required. An empty `turbopack` config silences the
// "webpack config with no turbopack config" build error.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["resium", "cesium"],
  // `libsql` is a native module (Turso/SQLite). It must be resolved at runtime
  // from node_modules, never bundled/traced by Turbopack — externalize it so
  // the prebuilt .node binary loads correctly in the serverless function.
  serverExternalPackages: ["libsql"],
  turbopack: {},
  // Cesium's runtime assets (~7.7 MB of workers/wasm/textures) and the country
  // GeoJSON live under /public, which Next otherwise serves as
  // `max-age=0, must-revalidate` — re-checked on every load, the main drag on
  // the "INITIALIZING GLOBAL VIEW" wait. They're static per deploy, so cache
  // them hard; a new deploy changes the referencing chunk hash, not these paths.
  async headers() {
    return [
      {
        source: "/cesium/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
