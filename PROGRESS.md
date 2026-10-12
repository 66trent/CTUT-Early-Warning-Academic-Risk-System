# Tiến độ

Mỗi phase ghi tối đa ~15 dòng: đã làm gì, file chính, kết quả test, việc còn lại, cách tự kiểm tra trên giao diện.

## Phase 0 — Hạ tầng (2026-10-12)

- Làm: Next.js 16 + TS 5.9 strict, Tailwind 4 + shadcn/ui, token màu `03` (sáng/tối), khung AppShell (sidebar, header tên/vai trò/học kỳ), `/design-check`; Docker 6 service (user không root, port chỉ mở 127.0.0.1); env Zod; TypeORM singleton; 4 queue BullMQ + worker; `/api/health`; CI; Husky + lint-staged.
- File chính: `src/app/globals.css`, `src/components/layout/app-shell.tsx`, `src/lib/env.ts`, `src/db/{enums,data-source}.ts`, `scripts/{db-init,run-migrations,seed}.ts`, `src/workers/index.ts`, `docker-compose.yml`, `Dockerfile.{app,worker}`, `.github/workflows/ci.yml`.
- Kiểm tra: typecheck, lint, format:check, db:init (chạy 2 lần), migration:run, migration:check, seed, test (23/23), build — xanh. `docker compose --profile dev up` đủ 6 service, `/api/health` 200; thiếu biến môi trường → app thoát mã 1.
- CI trên GitHub: xanh (PR #1).
- Lỗ hổng dev-only chưa có bản vá: `braces ≤3.0.3` (qua `eslint-config-next` → `fast-glob`), không vào image production. Kiểm tra lại mỗi phase.
- Việc còn lại: chọn lại thư viện biểu đồ thay Tremor (peer dependency chỉ nhận React 18) trước Phase 6.
- Tự kiểm tra: `docker compose --profile dev up -d --build` → mở http://localhost:3000/design-check, bấm nút mặt trăng/mặt trời để so màu sáng/tối; thu nhỏ cửa sổ thấy menu chuyển thành nút ☰.

## Phase 1 — Xác thực và danh tính (2026-10-12)

- Làm: entity `User`, `Department`, `AdministrativeClass`, `Student`, `Term`, `AuditLog` + migration `Phase1Identity` (CHECK email sinh viên, partial unique index học kỳ hiện tại); seed 7 khoa + Admin (mã `ADMIN`); Better Auth (Google cho sinh viên, email/mật khẩu + xác minh email cho cán bộ, session 8h, rate-limit); chính sách tạo tài khoản 5 mã lỗi, không tự tạo hồ sơ; `getCurrentUser()`/`requireUser()` (React.cache), `assertScope()` qua lớp sinh hoạt; `/login` 2 tab, `/register`, `/no-profile`, `/pending-approval`; đăng nhập nhanh demo = endpoint Better Auth (403 khi tắt); layout theo vai trò chặn ở server; `writeAuditLog()`.
- File chính: `src/lib/{auth,auth-policy,auth-server,authz,audit}.ts`, `src/db/entities/*`, `src/modules/admin/{actions,services,validators}/*advisor*`, `src/app/{login,register,no-profile,pending-approval,admin,advisor,student}`.
- Kiểm tra: typecheck, lint, format, db:init, migration, schema drift, seed (chạy 2 lần), test 59/59, build — xanh. Test DoD: NO_STUDENT_PROFILE/INVALID_DOMAIN/STAFF_ACCOUNT_NOT_FOUND không phát sinh bản ghi; CVHT chờ duyệt bị chặn; demo tắt → 403; CVHT A không đọc được SV lớp CVHT B; bảng auth.* khớp Better Auth 1.7.
- Kiểm tra tay (đã làm trên trình duyệt): đăng nhập Admin; sai mật khẩu báo lỗi; Admin mở /advisor bị chuyển về /admin; đăng ký CVHT → email MailHog → xác minh → trang "Đang chờ duyệt".
- Sửa sau khi chạy Docker: bản production nhân bản module → TypeORM không nhận entity (lỗi 500 khi đăng nhập); DataSource giờ cache theo từng bản sao. Đã thử lại trong container.
- Chưa kiểm chứng: đăng nhập Google thật (cần tài khoản sinh viên có hồ sơ — có từ Phase 3 khi nhập danh sách sinh viên).
- Lưu ý: Better Auth cảnh báo AUTH_SECRET có độ ngẫu nhiên thấp — nên thay bằng chuỗi ngẫu nhiên.
- Tự kiểm tra: http://localhost:3000 → tab Cán bộ → "Quản trị viên"; /register đăng ký CVHT, mở email ở http://localhost:8025, bấm liên kết → thấy trang chờ duyệt.

## Phase 2 — Danh mục quản trị (2026-10-12)

- Làm: Học kỳ (tạo theo số học kỳ + năm, đặt hiện tại trong transaction, chốt có xác nhận); Khoa (chỉ xem, số lớp); Lớp sinh hoạt (tạo, sửa, gán/đổi CVHT trong transaction, sĩ số bằng COUNT … GROUP BY); Tài khoản (lọc vai trò/trạng thái, tìm kiếm, phân trang, duyệt/từ chối/khóa/mở khóa, đổi vai trò ADVISOR↔ADMIN, sửa mã khi chờ duyệt; cấm tự đổi của mình; CVHT đang phụ trách lớp không khóa/đổi vai trò được); mọi thao tác ghi Audit Log; `runAction()` dùng chung cho Server Action; `seed:demo` (GV001/GV002, KTPM2311/KHMT2311, HK2_2025/HK1_2026 hiện tại).
- File chính: `src/modules/admin/{services,actions,validators}/{term,class,account}*`, `src/components/admin/*`, `src/components/data-table/data-table.tsx`, `src/app/admin/{terms,classes,users}/page.tsx`, `src/db/seeds/demo-seed.ts`, `src/lib/{action,dates}.ts`.
- Kiểm tra: typecheck, lint, format, db:init, migration, schema drift, seed, seed:demo (chạy 2 lần), test 82 (+1 bỏ qua ở chế độ `STAFF_EMAIL_DOMAIN=*`), build — xanh. DoD: 2 học kỳ hiện tại → lỗi 23505; duyệt CVHT → đăng nhập được và đọc được SV lớp mình; DTO thuần (kiểm tra prototype).
- Lỗi tìm ra khi chạy giao diện: danh sách CVHT truyền instance entity xuống client ("Only plain objects…") — đã sửa và thêm vào test DTO.
- Cần người dùng xác nhận: mã khoa Cơ khí `K.CK` (rule 09) hay `K.KTCK` (code seed) — DB đang có cả 2.
- Tự kiểm tra: Admin → Tài khoản → duyệt `GV02`; Khoa và lớp sinh hoạt → tạo lớp, gán CVHT; Học kỳ → đổi học kỳ hiện tại, header đổi theo. Sĩ số > 0 sẽ thấy sau khi nhập danh sách sinh viên (Phase 3).
