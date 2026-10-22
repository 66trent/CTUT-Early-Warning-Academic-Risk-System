/**
 * npm run seed       — dữ liệu nền bắt buộc: 7 khoa + tài khoản Admin đầu tiên (từ biến môi trường).
 * npm run seed:demo  — thêm dữ liệu nền demo theo docs/demo-data/KET_QUA_MONG_DOI.md.
 *                      Chỉ chạy khi DEMO_MODE=true.
 * Idempotent: chạy lại không tạo trùng, không đổi mật khẩu đã có.
 */
import 'dotenv/config';
import { closeDataSource, getDataSource } from '../src/db/data-source';
import { seedBase } from '../src/db/seeds/base-seed';
import { seedDemo } from '../src/db/seeds/demo-seed';
import { getAuth } from '../src/lib/auth';
import { getEnv } from '../src/lib/env';

async function main(): Promise<void> {
  const env = getEnv();
  const report = await seedBase(await getDataSource(), getAuth(), env);
  console.log(
    `seed — ${report.departments} khoa, 5 ngành Khoa CNTT; Admin ${report.adminCreated ? 'đã tạo' : 'đã có sẵn'} (${env.ADMIN_SEED_EMAIL}); ${report.rulesCreated} luật mới (12 luật + RISK-SCORE).`,
  );
  if (process.argv.includes('--demo')) {
    const demo = await seedDemo(await getDataSource(), getAuth(), env);
    console.log(
      `seed:demo — 5 Cố vấn học tập (${demo.advisorsCreated} mới), 5 lớp khóa 2024 Khoa CNTT, học kỳ HK3_2024 + HK1_2025 (hiện tại).`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error('seed lỗi:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDataSource())
  .finally(() => process.exit());
