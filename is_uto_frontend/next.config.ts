import type { NextConfig } from "next";

const BACKEND = process.env.BACKEND_URL ?? "https://ayacom-production.up.railway.app";

const nextConfig: NextConfig = {
  cleanDistDir: false,
  async rewrites() {
    return [
      {
        source: "/health",
        destination: `${BACKEND}/health`,
      },
      {
        source: "/api/:path*",
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
