import type { NextConfig } from "next";

// 与 src/lib/socket.ts 保持一致：BACKEND=hiclaw 时 API 代理到桥(8650)，否则 legacy(8648)。
const BACKEND = process.env.NEXT_PUBLIC_BACKEND === 'hiclaw' ? 'hiclaw' : 'legacy';
const API_TARGET =
  BACKEND === 'hiclaw'
    ? process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:8650'
    : process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8648';

const nextConfig: NextConfig = {
  transpilePackages: ['@hermes/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
