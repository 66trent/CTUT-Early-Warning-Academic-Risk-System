import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // TypeORM dùng decorator + require động: không cho bundler xử lý (xem docs/rules/01-architecture.md)
  serverExternalPackages: ['typeorm', 'pg', 'pino', 'bullmq', 'ioredis', 'minio', 'exceljs'],
  experimental: {
    // File nhập liệu tối đa 20MB (docs/rules/06) + phần dư cho FormData.
    serverActions: { bodySizeLimit: '21mb' },
  },
};

export default nextConfig;
