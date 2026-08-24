import type { NextConfig } from "next";

// Vercel-safe configuration.
// - No filesystem or Node-only APIs at build time.
// - `process.cwd()` instead of `__dirname` so the config loads correctly in
//   both CommonJS and ESM evaluation contexts (Vercel build containers).
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    // Pin the workspace root to this project (avoids multi-root inference
    // warnings when the repository is nested in a parent workspace).
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;