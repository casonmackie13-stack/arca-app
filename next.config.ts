import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  allowedDevOrigins: [
    "192.168.254.40",
  ],
};

export default nextConfig;
