/**
 * npm run seed       — dữ liệu nền bắt buộc: 7 khoa + tài khoản Admin đầu tiên (từ biến môi trường).
 * npm run seed:demo  — dữ liệu nền demo theo docs/demo-data/KET_QUA_MONG_DOI.md (Phase 2).
 *                      Chỉ chạy khi DEMO_MODE=true.
 * Idempotent: chạy lại không tạo trùng, không đổi mật khẩu đã có.
 */
import 'dotenv/config';
import { closeDataSource, getDataSource } from '../src/db/data-source';
import { seedBase } from '../src/db/seeds/base-seed';
import { getAuth } from '../src/lib/auth';
import { getEnv } from '../src/lib/env';

function seedDemo(): void {
  if (!getEnv().DEMO_MODE) throw new Error('seed:demo chỉ chạy khi DEMO_MODE=true.');
  // Phase 2: CVHT GV001/GV002, lớp KTPM2311/KHMT2311, học kỳ HK2_2025/HK1_2026.
  console.log('seed:demo — chưa có dữ liệu demo (sẽ thêm ở Phase 2).');
}

async function main(): Promise<void> {
  const env = getEnv();
  const report = await seedBase(await getDataSource(), getAuth(), env);
  console.log(
    `seed — ${report.departments} khoa; Admin ${report.adminCreated ? 'đã tạo' : 'đã có sẵn'} (${env.ADMIN_SEED_EMAIL}).`,
  );
  if (process.argv.includes('--demo')) seedDemo();
}

main()
  .catch((error: unknown) => {
    console.error('seed lỗi:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDataSource())
  .finally(() => process.exit());
