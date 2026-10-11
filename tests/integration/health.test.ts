import { afterAll, describe, expect, it } from 'vitest';
import { closeDataSource } from '@/db/data-source';
import { getHealthReport } from '@/modules/admin/services/health.service';

/** Cần PostgreSQL + Redis đang chạy (docker compose up -d postgres redis, hoặc service của CI). */
describe('GET /api/health — kiểm tra DB và Redis', () => {
  afterAll(async () => {
    await closeDataSource();
  });

  it('trả ok khi cả PostgreSQL và Redis hoạt động', async () => {
    const report = await getHealthReport();
    expect(report.services).toEqual({ database: 'up', redis: 'up' });
    expect(report.status).toBe('ok');
  });
});
