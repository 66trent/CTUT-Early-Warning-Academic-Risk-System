import { defineConfig, devices } from '@playwright/test';

/**
 * Kiểm thử end-to-end 2 luồng chính (docs/rules/02, người dùng chốt 2026-10-15): chạy trên máy,
 * không vào CI. Cần app ở http://localhost:3000 (Docker hoặc `npm run dev` + worker) và dữ liệu
 * demo chuẩn (`npm run demo:reset -- --yes`). Chạy: `npm run test:e2e`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
