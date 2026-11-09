import type { NextConfig } from "next";
const config: NextConfig = {
  agentRules: false,
  distDir:
    process.env.LARKOVART_BROWSER_TEST === "1" ? ".next-browser" : ".next",
  poweredByHeader: false,
  images: {
    remotePatterns: process.env.CLOUDINARY_CLOUD_NAME
      ? [
          {
            protocol: "https",
            hostname: "res.cloudinary.com",
            pathname: `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/**`,
          },
        ]
      : [],
  },
  outputFileTracingIncludes: {
    "/api/studio/social/**": ["./public/artworks/**/*"],
    "/api/cron/social": ["./public/artworks/**/*"],
  },
  serverExternalPackages: ["@libsql/client", "@libsql/kysely-libsql"],
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
