import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.eurobasket.com",
      },
      {
        protocol: "https",
        hostname: "www.eurobasket.net",
      },
      {
        protocol: "https",
        hostname: "basketball.eurobasket.com",
      },
    ],
  },
};

export default nextConfig;
