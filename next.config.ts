import type { NextConfig } from "next";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

// Turbopack resolves bare `tailwindcss` from the wrong directory when the project path contains a space.
const tailwindCssStylesheet = path.join(
  path.dirname(require.resolve("tailwindcss/package.json")),
  "index.css",
);

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    resolveAlias: {
      tailwindcss: tailwindCssStylesheet,
    },
  },
};

export default nextConfig;
