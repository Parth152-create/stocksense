import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8081/api/:path*",
      },
    ];
  },

  images: {
    domains: ["logo.clearbit.com", "img.logo.dev"],
  },
};

export default nextConfig;