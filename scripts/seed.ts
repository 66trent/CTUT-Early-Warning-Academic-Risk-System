/**
 * npm run seed       — dữ liệu nền bắt buộc (7 khoa, tài khoản Admin đầu tiên) — Phase 1.
 * npm run seed:demo  — dữ liệu nền demo theo docs/demo-data/KET_QUA_MONG_DOI.md — Phase 2.
 *                      Chỉ chạy khi DEMO_MODE=true.
 * Idempotent: chạy lại không tạo trùng.
 */
import 'dotenv/config';
import { closeDataSource, getDataSource } from '../src/db/data-source';
import { getEnv } from '../src/lib/env';

async function seedBase(): Promise<void> {
  // Phase 1: Department (7 khoa) + Admin từ ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD.
  await getDataSource();
  console.log('seed — chưa có dữ liệu nền nào cần tạo (sẽ thêm ở Phase 1).');
}

function seedDemo(): void {
  if (!getEnv().DEMO_MODE) {
    throw new Error('seed:demo chỉ chạy khi DEMO_MODE=true.');
  }
  // Phase 2: CVHT GV001/GV002, lớp KTPM2311/KHMT2311, học kỳ HK2_2025/HK1_2026.
  console.log('seed:demo — chưa có dữ liệu demo (sẽ thêm ở Phase 2).');
}

async function main(): Promise<void> {
  getEnv();
  await seedBase();
  if (process.argv.includes('--demo')) seedDemo();
}

main()
  .catch((error: unknown) => {
    console.error('seed lỗi:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDataSource());
