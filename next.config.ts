import type { NextConfig } from "next";

// Next.js 16 uses Turbopack by default. Cesium ships prebuilt worker/asset
// bundles that we copy into /public/cesium via scripts/copy-cesium.mjs, so no
// custom bundler rules are required. An empty `turbopack` config silences the
// "webpack config with no turbopack config" build error.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["resium", "cesium"],
  turbopack: {},
};

export default nextConfig;
