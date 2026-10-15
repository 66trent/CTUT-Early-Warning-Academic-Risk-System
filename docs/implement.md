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

- [x] Entity `ImportBatch`, `ImportErrorRow` (`12`: có `fileName`, `warnings`, `summary`, `errorMessage`; partial unique index chống nạp trùng); migration.
- [x] Upload (Server Action, chỉ Admin, rate-limit): kiểm tra đuôi `.csv`/`.xlsx` + nội dung thật + ≤ 20MB; SHA-256; lưu file gốc MinIO (tự tạo bucket); tạo batch `UPLOADING` → job `import-batch-process` (`jobId` = id batch).
- [x] Bộ đọc file dùng chung: CSV (BOM, `,`/`;`, số `7,5`, RFC 4180, stream) và XLSX (sheet đầu); chuẩn hóa header có dấu/không dấu + bí danh; chuẩn hóa ngày (`YYYY-MM-DD`, `DD/MM/YYYY`, `HH:mm DD/MM/YYYY`, từ chối ngày mơ hồ), giờ Việt Nam; bỏ qua cột thừa.
- [x] Quy trình 2 bước: `VALIDATING` → `STAGED` (xem trước: số dòng hợp lệ/lỗi, vài dòng mẫu, cảnh báo khi lỗi > 10%) → Admin **Xác nhận nạp** (kiểm tra lại toàn bộ với dữ liệu nền lúc nạp → `LOADED` → `RECONCILED`) hoặc **Hủy** (`DISCARDED`, AlertDialog); `STAGED` quá 7 ngày tự hủy; lỗi cả file → `REJECTED` kèm lý do; khóa nạp theo (loại, học kỳ); giới hạn 50.000 dòng, XLSX chống zip bomb. Audit Log mọi thao tác batch.
- [x] **Hoàn tác lô** có điều kiện (`ROLLED_BACK`): chỉ lô chỉ-thêm-mới, chưa có lần chạy đánh giá sau đó, chưa bị lô khác ghi đè; AlertDialog; nút vô hiệu kèm lý do khi không đủ điều kiện.
- [x] Loại nhập `STUDENT`: tạo/cập nhật `Student` + `User` sinh viên; `CLASS_NOT_FOUND`, email sai đuôi, trùng trong file, email thuộc người khác.
- [x] Màn hình nhập: chọn loại, chọn học kỳ (mặc định hiện tại, chặn học kỳ đã chốt), tải 4 file mẫu `public/templates/`, lịch sử batch (lọc, phân trang), chi tiết batch + bảng dòng lỗi, nút **Tải file lỗi** (Route Handler, CSV UTF-8 BOM, có cột diễn giải tiếng Việt, chống chèn công thức), nạp lại file đã sửa (`parentBatchId`). Lời văn theo `07`.

**DoD:** nạp `docs/demo-data/01_sinh_vien.csv` (cả bản CSV và bản lưu lại bằng Excel `.xlsx`) → 13 sinh viên, 0 lỗi; nạp lại cùng file bị chặn; hủy batch `STAGED` không ghi dữ liệu; file thiếu cột → `REJECTED`; dòng lớp lạ → `CLASS_NOT_FOUND`; test bộ đọc (BOM, `;`, `7,5`, ngày mơ hồ bị từ chối); lớp bị xóa giữa lúc xem trước và xác nhận → dòng thành lỗi; hoàn tác lô sinh viên vừa nạp → về đúng trạng thái trước; ô `=1+1` trong file lỗi xuất ra có tiền tố `'`. **Kiểm tra tay:** sửa 1 dòng sai, nạp, tải file lỗi thấy lý do dễ hiểu; trang Lớp sinh hoạt thấy sĩ số KTPM2311 = 12, KHMT2311 = 1 (mục còn lại của Phase 2).

## Phase 3b — Nhập 3 nguồn dữ liệu học tập

- [x] Entity `Course`, `Enrollment`, `AttendanceSummary`, `LmsQuizAttempt`, `CourseResult` (`09`, `10`: `letterGrade` 2 ký tự, không lưu điểm hệ 4); migration.
- [x] 3 loại nhập `ATTENDANCE_SUMMARY`, `LMS_QUIZ`, `COURSE_RESULT` trên khung 3a; upsert theo khóa nghiệp vụ (nạp lại = cập nhật); kiểm tra ngày trong thời gian học kỳ (`TERM_MISMATCH`); chuẩn hóa `8/10`, `12 phút`, `Đã nộp`, `Đạt`/`Không đạt`.
- [x] Tự upsert `Course` và tạo `Enrollment` (tính `attemptNumber`) trong cùng transaction; `CourseResult` `PROCESS_ONLY` → `FINAL` cập nhật `attemptOutcome`, `COMPLETED`, `Course.credits`; `RESULT_ALREADY_FINAL`; cảnh báo điểm chữ lệch thang 9 mức; tính lại `attemptNumber` học kỳ sau khi kết quả thay đổi.

**DoD:** nạp được 5 file `docs/demo-data/` theo đúng thứ tự, 0 dòng lỗi, 0 cảnh báo; số bản ghi khớp file; nạp lại cùng file bị chặn; nạp lại cùng ngày chốt / cùng lượt làm bài cập nhật chứ không nhân đôi; dòng `mssv` lạ → `STUDENT_NOT_FOUND`; KTPM2311009 · KTPM103 · HK1_2026 có `attemptNumber = 2` kể cả khi nạp file HK1 trước file HK2. **Kiểm tra tay:** sửa 1 dòng sai trong file điểm danh, nạp, tải file lỗi thấy lý do dễ hiểu.

## Phase 4 — Rule engine

- [x] Entity `Rule`, `RuleVersion`, `RuleTrigger`, `RiskScoreLog`, `EvaluationRun` (có `asOf`) theo `11`; seed 10 luật với ngưỡng mặc định của `08`.
- [x] Evaluator thuần, mỗi luật 1 file + registry; 10 bước; `DataStatus` từng nhóm; RiskScore chuẩn hóa; `COMB-*` chạy sau cùng.
- [x] `EvaluationRun`: tự động sau nạp `RECONCILED` và chạy tay; chặn 2 lần chạy cùng phạm vi; cập nhật tiến độ; `asOf` chọn được khi `DEMO_MODE=true`; queue `evaluation-run` (1 job / lần chạy, thay 2 queue cũ — `01`).
- [x] Sửa luật tạo `RuleVersion` mới; dry-run read-only; chặn kích hoạt khi chưa dry-run.
- [x] Test mỗi luật: kích hoạt, sát ngưỡng, ngoại lệ, thiếu dữ liệu; test `FULL`/`PARTIAL`/`INSUFFICIENT`; test chống rò rỉ thời gian.
- [x] **Test nghiệm thu:** nạp `docs/demo-data/`, chạy 2 lần với `asOf` trong `KET_QUA_MONG_DOI.md`, so khớp đúng và đủ danh sách trigger.

**DoD:** toàn bộ test xanh, test nghiệm thu khớp 100%; engine không ghi `officialAcademicStatus`.

## Phase 5 — Cảnh báo, giao diện CVHT và sinh viên

- [x] Entity `Alert` (1 / sinh viên / học kỳ, `lastAsOf`, `assignedAdvisorId` NULL được, CHECK `isReferenceOnly`), `AlertStateHistory`, `Intervention` (`status` DONE/FOLLOW_UP), `Notification` (`readAt`); FK `rule_triggers.alert_id` (`11`). `AuditLog` đã có từ Phase 1. Đổi `Rule.cooldown` đã seed (168) về 0.
- [x] Gộp trigger mỗi lần chạy vào `Alert` theo `08` (bước 7–9): severity = max lần chạy gần nhất; mở lại theo dấu hiệu mới/nặng hơn; lần chạy mốc cũ chỉ thêm bằng chứng; `INVALIDATED` sau hoàn tác lô; đếm `alertsCreated/Updated`.
- [x] Máy trạng thái theo bảng chuyển ở `11`, mỗi chuyển ghi `AlertStateHistory` + Audit Log; `DISMISSED`/`INVALIDATED` bắt buộc lý do; `RESOLVED` bắt buộc có can thiệp; chỉ Cố vấn học tập phụ trách (suy ra qua lớp) xử lý.
- [x] Đổi Cố vấn học tập của lớp (kể cả lớp chưa có người) → chuyển `Alert` đang mở trong cùng transaction; sinh viên đổi lớp qua nhập danh sách → như vậy.
- [x] Thông báo `send-notifications` chỉ tới Cố vấn học tập theo `06` (LOW chỉ IN_APP); email Nodemailer (MailHog ở dev); chuông thông báo + số chưa đọc; jobId chống trùng khi retry.
- [x] Cố vấn học tập: danh sách cần xử lý (sắp theo Severity, lọc học kỳ), chi tiết nhóm lý do theo 3 nguồn kèm số liệu và ngày dữ liệu (Accordion, tải bằng chứng khi mở), xác nhận + ghi can thiệp trong Sheet (≤ 2 click), "Đánh dấu đã xem" cho LOW, hồ sơ sinh viên theo học phần.
- [x] Sinh viên: "Tình hình học tập của bạn" — chỉ cảnh báo đã xác nhận, mức "Cần chú ý"/"Ổn định", số liệu từng học phần, lời văn tích cực, nút liên hệ Cố vấn học tập (email).
- [x] Admin: xem cảnh báo chỉ đọc, ẩn nội dung `SENSITIVE`, mục "Chưa có Cố vấn học tập phụ trách"; mở hồ sơ sinh viên ghi Audit Log.
- [x] Đăng nhập nhanh demo thêm 2 sinh viên (`KTPM2311003`, `KTPM2311001`) khi `DEMO_MODE=true`.
- [x] Test nghiệm thu cảnh báo theo bảng "Cảnh báo mong đợi (Phase 5)" + kịch bản mở lại/tăng mức trong `KET_QUA_MONG_DOI.md`.

**DoD:** test: Admin không đổi được trạng thái `Alert`; CVHT khác không xử lý được; sinh viên không thấy của người khác; chạy lại đánh giá không tạo `Alert` trùng. **Kiểm tra tay:** làm hết mục "Kiểm tra phân quyền bằng tay" trong `KET_QUA_MONG_DOI.md`; CVHT xử lý 1 cảnh báo đến `RESOLVED`.

## Phase 6 — Quản trị và vận hành

- [x] Cấu hình luật: xem bản `ACTIVE`, tạo phiên bản mới, dry-run (ước tính số sinh viên bị ảnh hưởng), kích hoạt có xác nhận, rồi gợi ý chạy ngay.
- [x] "Chạy đánh giá ngay": chọn học kỳ (tùy chọn học phần), tiến độ thật, tóm tắt kết quả và cảnh báo chất lượng dữ liệu.
- [x] Đánh dấu "đã rút học phần" cho 1 `Enrollment` (Audit Log).
- [x] Nhật ký kiểm toán (lọc, chỉ đọc); trang chính sách dữ liệu cá nhân theo `04`. (Ẩn danh hóa sinh viên: hoãn theo yêu cầu người dùng 2026-10-13.)
- [x] Tổng quan Admin: số sinh viên theo lớp, số cảnh báo theo mức, chất lượng nhập liệu, sinh viên `INSUFFICIENT`.
- [x] Trang "Bắt đầu": checklist theo "Quy trình vận hành" ở `00`, tự đánh dấu bước đã có dữ liệu.
- [x] (Thêm) Trang tìm sinh viên `/admin/students` — lối vào hồ sơ để đánh dấu rút học phần khi sinh viên chưa có cảnh báo.

**DoD:** **kiểm tra tay** từ DB rỗng (chỉ `seed`), làm theo trang "Bắt đầu" và `KET_QUA_MONG_DOI.md` đến khi CVHT thấy đúng các cảnh báo mong đợi, không sửa DB tay.

## Phase 7 — Hoàn thiện và demo

Làm trước (chốt 2026-10-15, chạy lại nghiệm thu sau khi xong):
- [x] Sửa: lần chạy theo 1 học phần không được hạ mức cảnh báo (`08`).
- [x] Nhãn "lần đánh giá gần nhất không còn dấu hiệu" trên cảnh báo đang mở (`08`).
- [x] Lịch chạy đánh giá mỗi đêm, `EvaluationTrigger.SCHEDULED` (migration thêm giá trị enum) (`05`, `08`) — tắt khi `DEMO_MODE=true`; chế độ demo cũng không tự chạy sau nạp.
- [x] (Thêm, chốt 2026-10-15) Dữ liệu quá hạn ≠ hết dấu hiệu: `Alert.currentTriggerIds`, giữ dấu hiệu điểm danh của học phần quá hạn (`08`, `11`).
- [x] Bộ lọc Khoa: Tổng quan, cảnh báo Admin, chọn học phần khi chạy đánh giá (`07`).

- [x] Rà bảo mật theo `06` (STRIDE, rate-limit, TLS, không `dangerouslySetInnerHTML`, `npm audit` không có high/critical).
- [x] Hiệu năng theo `05`: seed lớn (≥ 5.000 sinh viên), `EXPLAIN ANALYZE` truy vấn danh sách cảnh báo và đánh giá; thời gian chạy đánh giá 1 học kỳ.
- [x] Backup/restore: lệnh `npm run backup` / `npm run restore` chạy tay + hướng dẫn đặt lịch trong README; diễn tập khôi phục 1 lần vào DB tạm, ghi thời gian (RPO ≤ 24h, RTO ≤ 4h).
- [x] Đo hiệu năng trên DB riêng `ewars_perf` (seed ≥ 5.000 SV giả); danh sách > 300ms mới đổi keyset; bảng số liệu cho báo cáo.
- [x] Playwright 2 luồng (nhập file lỗi → sửa → nhập lại; CVHT xác nhận + ghi can thiệp), chạy local, không vào CI.
- [x] README chạy từ máy sạch (kèm hướng dẫn TLS khi triển khai, cấu hình Google OAuth, sinh `AUTH_SECRET`); sinh `AUTH_SECRET` mới; đặt lại `STAFF_EMAIL_DOMAIN=@ctuet.edu.vn`.
- [x] Responsive 3 kích thước màn hình; dark mode.
- [x] Kịch bản demo theo `KET_QUA_MONG_DOI.md`, phủ MỌI tình huống hệ thống đáp ứng được: 1 kịch bản chính (bộ demo hiện tại, trình bày 10 phút) + nhiều kịch bản nhỏ ở `docs/demo-data/kich-ban/NN-ten/` (file dữ liệu + các bước + kết quả mong đợi riêng; dùng chung lớp KTPM2311/KHMT2311 + GV001/GV002, mỗi kịch bản 1 dải MSSV riêng để nạp chồng không đụng nhau; mỗi kịch bản 1 test nghiệm thu); `docs/demo-script.md` có mục "hội đồng hỏi X → mở kịch bản Y"; `docs/demo-script.md`; lệnh `npm run demo:reset`; ảnh chụp màn hình; bảng số liệu hiệu năng. (Sinh viên đăng nhập bằng đăng nhập nhanh demo; ẩn danh hóa vẫn hoãn — ghi là hướng phát triển.)

**DoD:** build production chạy từ máy sạch theo README; demo trọn kịch bản không lỗi.
