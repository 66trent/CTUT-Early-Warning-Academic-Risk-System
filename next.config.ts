import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // TypeORM dùng decorator + require động: không cho bundler xử lý (xem docs/rules/01-architecture.md)
  serverExternalPackages: ['typeorm', 'pg', 'pino', 'bullmq', 'ioredis', 'minio', 'exceljs'],
  // Header bảo mật cơ bản (docs/rules/06). HSTS/CSP bật ở reverse proxy HTTPS khi triển khai.
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]);
  },
  poweredByHeader: false,
  experimental: {
    // File nhập liệu tối đa 20MB (docs/rules/06) + phần dư cho FormData.
    serverActions: { bodySizeLimit: '21mb' },
  },
};

export default nextConfig;
