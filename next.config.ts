import type { NextConfig } from "next";

// Next.js 16 uses Turbopack by default. Cesium ships prebuilt worker/asset
// bundles that we copy into /public/cesium via scripts/copy-cesium.mjs.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["resium"],
  // `libsql` is a native module (Turso/SQLite). It must be resolved at runtime
  // from node_modules, never bundled/traced by Turbopack — externalize it so
  // the prebuilt .node binary loads correctly in the serverless function.
  serverExternalPackages: ["libsql"],
  // Ship the read-only vault snapshot INTO the intelligence API serverless
  // functions. It's the fallback getReadDb() serves when Turso's free read quota
  // is blocked — without it, the file exists in the repo but not in the function
  // bundle, so the fallback would ENOENT. Scoped to the vault-read routes only.
  outputFileTracingIncludes: {
    "/api/intelligence/**": ["./data/vault-snapshot.db"],
  },
  turbopack: {
    resolveAlias: {
      // Drop Cesium's Gaussian-Splat WASM loader — its inlined binary breaks
      // Turbopack's template-literal codegen and hangs the globe. See the stub.
      "@spz-loader/core": "./lib/stubs/spz-loader.ts",
    },
  },
  // Cesium's runtime assets (~7.7 MB of workers/wasm/textures) and the country
  // GeoJSON live under /public, which Next otherwise serves as
  // `max-age=0, must-revalidate` — re-checked on every load, the main drag on
  // the "INITIALIZING GLOBAL VIEW" wait. They're static per deploy, so cache
  // them hard; a new deploy changes the referencing chunk hash, not these paths.
  async headers() {
    // App-wide security headers. CSP is deliberately permissive on script/style
    // ('unsafe-inline' + 'unsafe-eval') because Cesium/Turbopack emit inline and
    // eval'd code and blob workers; it still blocks foreign origins, framing, and
    // mixed content. worker-src includes blob: for the generated model/GLB blobs
    // and Cesium web workers; connect-src is open (https/wss) for the many live
    // data providers fetched from the client.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "worker-src 'self' blob:",
      // Cesium connects to blob:/data: URLs (web workers, decoded tiles) and the
      // client fetches many live providers + OSM tiles over https/wss.
      "connect-src 'self' https: wss: blob: data:",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    const security = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
    ];
    return [
      { source: "/:path*", headers: security },
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
