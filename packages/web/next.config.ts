import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@hermes/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8648/api/:path*',
      },
    ];
  },
};

export default nextConfig;
