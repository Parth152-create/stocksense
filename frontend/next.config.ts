import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",

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

export default withSentryConfig(nextConfig, {
  org: "bgiem",
  project: "stocksense-frontend",
  silent: true,

  widenClientFileUpload: true,

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  disableLogger: true,
});