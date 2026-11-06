import type { NextConfig } from "next";
const config: NextConfig = {
  agentRules: false,
  distDir:
    process.env.LARKOVART_BROWSER_TEST === "1" ? ".next-browser" : ".next",
  poweredByHeader: false,
  serverExternalPackages: ["@libsql/client"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
