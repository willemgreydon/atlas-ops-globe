import next from "eslint-config-next";

// `next lint` was removed in Next.js 16; we run ESLint's flat config directly
// via `eslint .`. eslint-config-next ships a flat-config array in v16, so we
// spread it rather than going through FlatCompat.
const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "public/**",
      "coverage/**",
      "next-env.d.ts",
      "data/country-centroids.ts",
    ],
  },
  ...next,
  {
    // These fire for legitimate data-fetch-on-key-change and reset-on-open
    // effects (React's docs permit fetching in effects). Kept as warnings so
    // they surface without failing CI.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
