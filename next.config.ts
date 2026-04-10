import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler causes a benign Performance.measure timing error in
  // Turbopack dev mode (React 19 issue). Keep it enabled only for production.
  reactCompiler: process.env.NODE_ENV === "production",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
