# Kế hoạch triển khai (dự án mới, Claude Code)

> Cách dùng: yêu cầu từng phase, VD: "Thực hiện Phase 1 trong docs/implement.md". Mỗi phase có Definition of Done (DoD); chỉ sang phase sau khi đạt đủ DoD, kể cả mục **kiểm tra tay**. Xong mỗi phase: tick checklist ở đây và ghi tóm tắt ≤ 15 dòng vào `PROGRESS.md`.
>
> Nguồn sự thật: `docs/rules/00`–`12`. Bộ dữ liệu nghiệm thu: `docs/demo-data/` + `KET_QUA_MONG_DOI.md`. Bài học từ dự án cũ: `docs/bai-hoc-du-an-cu.md` — đọc trước Phase 0.
>
> Phạm vi: 3 role; nhập CSV từ 3 nguồn (điểm danh tổng hợp, bài kiểm tra LMS, kết quả học phần) + danh sách sinh viên; 10 luật trong `08`. Ngoài phạm vi: API đồng bộ SIS/LMS, SMS, lịch học từng buổi, đăng ký học phần riêng.

## Nguyên tắc mỗi vòng lặp

1. Đọc đúng file rule trước khi code; tên bảng/field khớp `09`–`12`; enum chỉ ở `src/db/enums.ts`.
2. Server Action: Zod validate → `assertScope()` → service → `writeAuditLog()` khi thuộc nhóm bắt buộc → trả DTO thuần.
3. Quyết định mới ngoài rules → cập nhật rule ngay và báo người dùng.
4. Kết thúc mỗi việc: `typecheck`, `lint`, test liên quan. Kết thúc phase: toàn bộ test + `build`.
5. Gặp đặc tả có vẻ sai nghiệp vụ → dừng, hỏi người dùng; không tự "sửa cho chạy".

## Thứ tự

| Phase | Nội dung | Phụ thuộc |
|---|---|---|
| 0 | Hạ tầng | — |
| 1 | Xác thực và danh tính | 0 |
| 2 | Danh mục quản trị | 1 |
| 3a | Khung nhập dữ liệu, danh sách sinh viên | 2 |
| 3b | Nhập 3 nguồn dữ liệu học tập | 3a |
| 4 | Rule engine | 3b |
| 5 | Cảnh báo, giao diện CVHT và sinh viên | 4 |
| 6 | Quản trị và vận hành | 5 |
| 7 | Hoàn thiện và demo | 6 |

---

## Phase 0 — Hạ tầng

- [x] Next.js 16 (App Router, TypeScript strict), Tailwind 4, shadcn/ui, `next-themes`, font Be Vietnam Pro, token màu trắng + xanh dương theo `03`; trang `/design-check` hiển thị nút, badge Severity, badge trạng thái, bảng, form.
- [x] Khung giao diện chung: sidebar trắng, header có tên người dùng, vai trò, học kỳ hiện tại (để trống đến Phase 2).
- [x] Docker Compose: `app`, `worker`, `postgres`, `redis`, `minio`, `mailhog` (profile `dev`); container chạy user không phải root.
- [x] `src/lib/env.ts` theo danh sách biến ở `01`; `.env.example` đầy đủ.
- [x] TypeORM: `data-source.ts` (singleton `globalThis`, `SnakeNamingStrategy`, `synchronize: false`, migration import trực tiếp), pool web 20 / worker 10.
- [x] `scripts/db-init.ts` (schema `auth`, `uuid-ossp`, bảng Better Auth), `scripts/run-migrations.ts`, `scripts/seed.ts`; npm scripts: `db:init`, `migration:run`, `seed`, `seed:demo`.
- [x] Vitest, ESLint, Prettier; CI đúng thứ tự ở `01`; `GET /api/health` kiểm tra DB và Redis.
- [x] `backups/` trong `.gitignore`; `PROGRESS.md` rỗng.

**DoD:** `docker compose up` chạy đủ service; `npm run db:init && npm run migration:run` chạy sạch trên DB rỗng; `/api/health` trả 200; CI xanh. **Kiểm tra tay:** mở `/design-check` thấy đúng màu ở cả sáng và tối.

## Phase 1 — Xác thực và danh tính

- [x] Entity: `User` (có `accountStatus`, `authUserId`), `Department`, `AdministrativeClass`, `Student`, `Term` theo `09`; seed 7 khoa và tài khoản Admin từ biến môi trường.
- [x] Better Auth: Google cho sinh viên; email/mật khẩu cho CVHT/Admin; hook `create.before` với 4 mã lỗi và `create.after` gán `authUserId` (theo `01`, `06`). Không tự tạo hồ sơ.
- [x] `getCurrentUser()` bọc `React.cache()`; `assertScope()`: sinh viên chỉ mình; CVHT qua `AdministrativeClass.advisorId`; Admin đọc tất cả, không xử lý `Alert`.
- [x] Trang `/login` 2 tab (Sinh viên / Cán bộ), ánh xạ mã lỗi; ẩn nút Google khi chưa cấu hình. Trang `/no-profile`, `/pending-approval`.
- [x] Đăng ký CVHT (mã cán bộ, họ tên, email đúng `STAFF_EMAIL_DOMAIN`) → `PENDING_APPROVAL`; rate-limit.
- [x] `DEMO_MODE`: nút đăng nhập nhanh tài khoản mẫu, kiểm tra ở server.
- [x] Layout theo role, chặn ở server.

**DoD (test tự động):** email sinh viên chưa có hồ sơ → `NO_STUDENT_PROFILE`, không phát sinh bản ghi; email ngoài trường → `INVALID_DOMAIN`; email cán bộ chưa có tài khoản → `STAFF_ACCOUNT_NOT_FOUND`; CVHT chờ duyệt bị chặn mọi dữ liệu; `DEMO_MODE=false` → đăng nhập nhanh trả 403; CVHT A không đọc được sinh viên lớp của CVHT B. **Kiểm tra tay:** đăng nhập Admin; đăng ký 1 CVHT và thấy trang chờ duyệt.

## Phase 2 — Danh mục quản trị

- [x] Học kỳ: tạo, đặt hiện tại (transaction, partial unique index), chốt học kỳ (AlertDialog); badge học kỳ hiện tại trên header.
- [x] Khoa (chỉ xem). Lớp sinh hoạt: tạo, sửa, gán/đổi CVHT; sĩ số bằng `COUNT ... GROUP BY`.
- [x] Tài khoản: danh sách, lọc trạng thái, duyệt/từ chối/khóa CVHT (Audit Log), đổi vai trò (cấm tự đổi của mình).
- [x] `npm run seed:demo` tạo dữ liệu nền demo theo `docs/demo-data/KET_QUA_MONG_DOI.md`.

**DoD:** không thể có 2 học kỳ hiện tại (test lỗi `23505`); duyệt CVHT → đăng nhập được; mọi Server Action trả DTO thuần. **Kiểm tra tay:** tạo lớp, gán CVHT, thấy sĩ số đúng.

## Phase 3a — Khung nhập dữ liệu và danh sách sinh viên

- [ ] Entity `ImportBatch`, `ImportErrorRow` (`12`: có `fileName`, `warnings`, `summary`, `errorMessage`; partial unique index chống nạp trùng); migration.
- [ ] Upload (Server Action, chỉ Admin, rate-limit): kiểm tra đuôi `.csv`/`.xlsx` + nội dung thật + ≤ 20MB; SHA-256; lưu file gốc MinIO (tự tạo bucket); tạo batch `UPLOADING` → job `import-batch-process` (`jobId` = id batch).
- [ ] Bộ đọc file dùng chung: CSV (BOM, `,`/`;`, số `7,5`, RFC 4180, stream) và XLSX (sheet đầu); chuẩn hóa header có dấu/không dấu + bí danh; chuẩn hóa ngày (`YYYY-MM-DD`, `DD/MM/YYYY`, `HH:mm DD/MM/YYYY`, từ chối ngày mơ hồ), giờ Việt Nam; bỏ qua cột thừa.
- [ ] Quy trình 2 bước: `VALIDATING` → `STAGED` (xem trước: số dòng hợp lệ/lỗi, vài dòng mẫu) → Admin **Xác nhận nạp** (→ `LOADED` → `RECONCILED`) hoặc **Hủy** (`DISCARDED`, AlertDialog); lỗi cả file → `REJECTED` kèm lý do. Audit Log mọi thao tác batch.
- [ ] Loại nhập `STUDENT`: tạo/cập nhật `Student` + `User` sinh viên; `CLASS_NOT_FOUND`, email sai đuôi, trùng trong file, email thuộc người khác.
- [ ] Màn hình nhập: chọn loại, chọn học kỳ (mặc định hiện tại, chặn học kỳ đã chốt), tải 4 file mẫu `public/templates/`, lịch sử batch (lọc, phân trang), chi tiết batch + bảng dòng lỗi, nút **Tải file lỗi** (Route Handler, CSV UTF-8 BOM, có cột diễn giải tiếng Việt), nạp lại file đã sửa (`parentBatchId`). Lời văn theo `07`.

**DoD:** nạp `docs/demo-data/01_sinh_vien.csv` (cả bản CSV và bản lưu lại bằng Excel `.xlsx`) → 13 sinh viên, 0 lỗi; nạp lại cùng file bị chặn; hủy batch `STAGED` không ghi dữ liệu; file thiếu cột → `REJECTED`; dòng lớp lạ → `CLASS_NOT_FOUND`; test bộ đọc (BOM, `;`, `7,5`, ngày mơ hồ bị từ chối). **Kiểm tra tay:** sửa 1 dòng sai, nạp, tải file lỗi thấy lý do dễ hiểu; trang Lớp sinh hoạt thấy sĩ số KTPM2311 = 12, KHMT2311 = 1 (mục còn lại của Phase 2).

## Phase 3b — Nhập 3 nguồn dữ liệu học tập

- [ ] Entity `Course`, `Enrollment`, `AttendanceSummary`, `LmsQuizAttempt`, `CourseResult` (`09`, `10`: `letterGrade` 2 ký tự, không lưu điểm hệ 4); migration.
- [ ] 3 loại nhập `ATTENDANCE_SUMMARY`, `LMS_QUIZ`, `COURSE_RESULT` trên khung 3a; upsert theo khóa nghiệp vụ (nạp lại = cập nhật); kiểm tra ngày trong thời gian học kỳ (`TERM_MISMATCH`); chuẩn hóa `8/10`, `12 phút`, `Đã nộp`, `Đạt`/`Không đạt`.
- [ ] Tự upsert `Course` và tạo `Enrollment` (tính `attemptNumber`) trong cùng transaction; `CourseResult` `PROCESS_ONLY` → `FINAL` cập nhật `attemptOutcome`, `COMPLETED`, `Course.credits`; `RESULT_ALREADY_FINAL`; cảnh báo điểm chữ lệch thang 9 mức; tính lại `attemptNumber` học kỳ sau khi kết quả thay đổi.

**DoD:** nạp được 5 file `docs/demo-data/` theo đúng thứ tự, 0 dòng lỗi, 0 cảnh báo; số bản ghi khớp file; nạp lại cùng file bị chặn; nạp lại cùng ngày chốt / cùng lượt làm bài cập nhật chứ không nhân đôi; dòng `mssv` lạ → `STUDENT_NOT_FOUND`; KTPM2311009 · KTPM103 · HK1_2026 có `attemptNumber = 2` kể cả khi nạp file HK1 trước file HK2. **Kiểm tra tay:** sửa 1 dòng sai trong file điểm danh, nạp, tải file lỗi thấy lý do dễ hiểu.

## Phase 4 — Rule engine

- [ ] Entity `Rule`, `RuleVersion`, `RuleTrigger`, `RiskScoreLog`, `EvaluationRun` (có `asOf`) theo `11`; seed 10 luật với ngưỡng mặc định của `08`.
- [ ] Evaluator thuần, mỗi luật 1 file + registry; 10 bước; `DataStatus` từng nhóm; RiskScore chuẩn hóa; `COMB-*` chạy sau cùng.
- [ ] `EvaluationRun`: tự động sau nạp `RECONCILED` và chạy tay; chặn 2 lần chạy cùng phạm vi; cập nhật tiến độ; `asOf` chọn được khi `DEMO_MODE=true`; queue `calculate-risk-score`, `evaluate-hard-triggers`.
- [ ] Sửa luật tạo `RuleVersion` mới; dry-run read-only; chặn kích hoạt khi chưa dry-run.
- [ ] Test mỗi luật: kích hoạt, sát ngưỡng, ngoại lệ, thiếu dữ liệu; test `FULL`/`PARTIAL`/`INSUFFICIENT`; test chống rò rỉ thời gian.
- [ ] **Test nghiệm thu:** nạp `docs/demo-data/`, chạy 2 lần với `asOf` trong `KET_QUA_MONG_DOI.md`, so khớp đúng và đủ danh sách trigger.

**DoD:** toàn bộ test xanh, test nghiệm thu khớp 100%; engine không ghi `officialAcademicStatus`.

## Phase 5 — Cảnh báo, giao diện CVHT và sinh viên

- [ ] Entity `Alert`, `AlertStateHistory`, `Intervention`, `Notification`, `AuditLog` (`11`).
- [ ] Tạo/cập nhật `Alert` theo khóa tương quan + cooldown; severity = max; `isReferenceOnly = true`.
- [ ] Máy trạng thái, mỗi chuyển ghi `AlertStateHistory` + Audit Log; `DISMISSED`/`INVALIDATED` bắt buộc lý do; chỉ CVHT phụ trách xử lý.
- [ ] Đổi CVHT của lớp → chuyển `Alert` đang mở trong cùng transaction (bổ sung vào chức năng Phase 2).
- [ ] Thông báo `send-notifications` theo sự kiện ở `06` (không chống gửi trùng); email qua Nodemailer (MailHog ở dev).
- [ ] CVHT: danh sách cần xử lý (sắp theo Severity), chi tiết nhóm lý do theo 3 nguồn kèm số liệu và ngày dữ liệu, ghi can thiệp trong Sheet, hồ sơ sinh viên theo học phần.
- [ ] Sinh viên: "Tình hình học tập của bạn", lời văn tích cực, nút liên hệ CVHT.
- [ ] Admin: xem cảnh báo chỉ đọc, ẩn nội dung `SENSITIVE`.

**DoD:** test: Admin không đổi được trạng thái `Alert`; CVHT khác không xử lý được; sinh viên không thấy của người khác; chạy lại đánh giá không tạo `Alert` trùng. **Kiểm tra tay:** làm hết mục "Kiểm tra phân quyền bằng tay" trong `KET_QUA_MONG_DOI.md`; CVHT xử lý 1 cảnh báo đến `RESOLVED`.

## Phase 6 — Quản trị và vận hành

- [ ] Cấu hình luật: xem bản `ACTIVE`, tạo phiên bản mới, dry-run (ước tính số sinh viên bị ảnh hưởng), kích hoạt có xác nhận, rồi gợi ý chạy ngay.
- [ ] "Chạy đánh giá ngay": chọn học kỳ (tùy chọn học phần), tiến độ thật, tóm tắt kết quả và cảnh báo chất lượng dữ liệu.
- [ ] Đánh dấu "đã rút học phần" cho 1 `Enrollment` (Audit Log).
- [ ] Nhật ký kiểm toán (lọc, chỉ đọc); trang chính sách dữ liệu cá nhân theo `04`; ẩn danh hóa sinh viên.
- [ ] Tổng quan Admin: số sinh viên theo lớp, số cảnh báo theo mức, chất lượng nhập liệu, sinh viên `INSUFFICIENT`.
- [ ] Trang "Bắt đầu": checklist theo "Quy trình vận hành" ở `00`, tự đánh dấu bước đã có dữ liệu.

**DoD:** **kiểm tra tay** từ DB rỗng (chỉ `seed`), làm theo trang "Bắt đầu" và `KET_QUA_MONG_DOI.md` đến khi CVHT thấy đúng các cảnh báo mong đợi, không sửa DB tay.

## Phase 7 — Hoàn thiện và demo

- [ ] Rà bảo mật theo `06` (STRIDE, rate-limit, TLS, không `dangerouslySetInnerHTML`, `npm audit` không có high/critical).
- [ ] Hiệu năng theo `05`: seed lớn (≥ 5.000 sinh viên), `EXPLAIN ANALYZE` truy vấn danh sách cảnh báo và đánh giá; thời gian chạy đánh giá 1 học kỳ.
- [ ] Backup/restore thử 1 lần (RPO ≤ 24h, RTO ≤ 4h).
- [ ] Responsive 3 kích thước màn hình; dark mode.
- [ ] Kịch bản demo 10 phút theo `KET_QUA_MONG_DOI.md`; chụp màn hình và số liệu hiệu năng cho báo cáo.

**DoD:** build production chạy từ máy sạch theo README; demo trọn kịch bản không lỗi.
