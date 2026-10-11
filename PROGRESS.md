# Tiến độ

Mỗi phase ghi tối đa ~15 dòng: đã làm gì, file chính, kết quả test, việc còn lại, cách tự kiểm tra trên giao diện.

## Phase 0 — Hạ tầng (2026-10-12)

- Làm: Next.js 16 + TS 5.9 strict, Tailwind 4 + shadcn/ui, token màu `03` (sáng/tối), khung AppShell (sidebar, header tên/vai trò/học kỳ), `/design-check`; Docker 6 service (user không root, port chỉ mở 127.0.0.1); env Zod; TypeORM singleton; 4 queue BullMQ + worker; `/api/health`; CI; Husky + lint-staged.
- File chính: `src/app/globals.css`, `src/components/layout/app-shell.tsx`, `src/lib/env.ts`, `src/db/{enums,data-source}.ts`, `scripts/{db-init,run-migrations,seed}.ts`, `src/workers/index.ts`, `docker-compose.yml`, `Dockerfile.{app,worker}`, `.github/workflows/ci.yml`.
- Kiểm tra: typecheck, lint, format:check, db:init (chạy 2 lần), migration:run, migration:check, seed, test (23/23), build — xanh. `docker compose --profile dev up` đủ 6 service, `/api/health` 200; thiếu biến môi trường → app thoát mã 1.
- Chưa kiểm chứng: CI trên GitHub (chưa push).
- Lỗ hổng dev-only chưa có bản vá: `braces ≤3.0.3` (qua `eslint-config-next` → `fast-glob`), không vào image production. Kiểm tra lại mỗi phase.
- Việc còn lại: chọn lại thư viện biểu đồ thay Tremor (peer dependency chỉ nhận React 18) trước Phase 6.
- Tự kiểm tra: `docker compose --profile dev up -d --build` → mở http://localhost:3000/design-check, bấm nút mặt trăng/mặt trời để so màu sáng/tối; thu nhỏ cửa sổ thấy menu chuyển thành nút ☰.
