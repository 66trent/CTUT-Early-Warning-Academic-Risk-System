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

## Phase 3a — Khung nhập dữ liệu và danh sách sinh viên (2026-10-12)

- Làm: entity `ImportBatch`, `ImportErrorRow` + migration (partial unique index chống nạp trùng chỉ với lô còn hiệu lực); lưu file gốc MinIO (interface, test dùng bộ nhớ); bộ đọc CSV theo stream (`csv-parse`: BOM, `,`/`;`, `7,5`, RFC 4180, số dòng thật) và XLSX (sheet đầu, chỉ giá trị ô); chuẩn hóa header có dấu + bí danh, ngày VN (từ chối ngày mơ hồ), kiểm tra file theo nội dung thật, chống zip bomb, ≤ 50.000 dòng; registry loại nhập + loại `STUDENT`; quy trình 2 bước (kiểm tra → xem trước → xác nhận, kiểm tra lại khi nạp, khóa theo loại+học kỳ, tự hủy lô chờ > 7 ngày); hoàn tác lô có điều kiện; file lỗi CSV (BOM, lý do tiếng Việt, chống chèn công thức); worker xử lý queue nhập 1 job/lần + lịch hằng ngày; màn Nhập dữ liệu, lịch sử, chi tiết lô.
- File chính: `src/modules/data-import/{parsing,types,services,actions}/*`, `src/lib/storage.ts`, `src/workers/processors/import-batch.processor.ts`, `src/app/admin/imports/**`, `src/app/api/imports/[batchId]/errors/route.ts`.
- Kiểm tra: typecheck, lint, format, migration, schema drift, test 130 (129 xanh + 1 bỏ qua ở chế độ `*`), build — xanh. DoD: file demo CSV và XLSX → 13 sinh viên, 0 lỗi; nạp lại bị chặn; hủy lô không ghi dữ liệu; thiếu cột → từ chối; lớp lạ → CLASS_NOT_FOUND; lớp bị xóa giữa chừng → dòng lỗi khi nạp; hoàn tác đúng; ô `=1+1` có tiền tố `'`.
- Kiểm tra tay (trình duyệt, MinIO + worker thật): nạp demo → sĩ số KTPM2311 = 12, KHMT2311 = 1 (đạt mục còn lại của Phase 2); file `;` + header có dấu + lỗi → bảng lỗi và file lỗi đúng; hoàn tác lô demo → DB về 0 sinh viên.
- Quyết định kỹ thuật (đã ghi rule 05/12): bỏ papaparse (stream chậm bậc hai: 50.000 dòng ~38 giây); XLSX đọc cả file vào bộ nhớ vì bản stream của exceljs bỏ sót dữ liệu (đo ~270MB ở mức trần); lưu thứ tự cột gốc vì jsonb tự sắp xếp khóa.
- Việc còn lại (3b): 3 nguồn dữ liệu học tập; điều kiện hoàn tác "chưa chạy đánh giá" thêm ở Phase 4.
- Tự kiểm tra: Admin → Nhập dữ liệu → nạp `docs/demo-data/01_sinh_vien.csv` → Xác nhận nạp → Khoa và lớp sinh hoạt thấy sĩ số; sửa 1 dòng (VD lớp `KTPM9999`), nạp → tải file lỗi.

## Phase 3b — Nhập 3 nguồn dữ liệu học tập (2026-10-12)

- Làm: entity `Course`, `Enrollment`, `AttendanceSummary`, `LmsQuizAttempt`, `CourseResult` + migration `Phase3bSourceRecords` (chỉ tạo bảng mới); 3 loại nhập `ATTENDANCE_SUMMARY`, `LMS_QUIZ`, `COURSE_RESULT` trên khung 3a; upsert theo khóa nghiệp vụ; `TERM_MISMATCH` (cột `hoc_ky`, ngày ngoài học kỳ); chuẩn hóa `8/10`, `12 phút`, `Đã nộp`, `Đạt`/`Không đạt`; thang điểm chữ 9 mức; tự tạo Course/Enrollment + tính lại `attemptNumber` trong cùng transaction; `RESULT_ALREADY_FINAL`; cảnh báo `LETTER_GRADE_MISMATCH`/`RESULT_MISMATCH` (`ImportBatch.warnings`, hiện ở trang chi tiết lô); hoàn tác lô nguồn (xóa dòng + Enrollment mồ côi, trả outcome, tính lại lần học); chặn hoàn tác lô sinh viên đã có dữ liệu học tập.
- File chính: `src/db/entities/{course,enrollment,attendance-summary,lms-quiz-attempt,course-result}.entity.ts`, `src/modules/data-import/types/{academic-row,attendance,lms-quiz,course-result}.import.ts`, `services/{enrollment-sync,source-rollback}.ts`, `parsing/grade-scale.ts`.
- Đổi ngày trong `docs/demo-data` 02–05 sang `YYYY-MM-DD` (quyết định đã chốt, file trước đó chưa đổi).
- Kiểm tra: typecheck, lint, format, migration, schema drift, test 183 (+1 bỏ qua), coverage data-import 84%, build, worker:build — xanh. DoD: 4 file demo → 29/17/32/10 bản ghi, 0 lỗi, 0 cảnh báo; nạp lại bị chặn; cùng ngày chốt / cùng lượt → cập nhật; mssv lạ → STUDENT_NOT_FOUND; KTPM2311009·KTPM103·HK1 = lần 2 cả khi nạp HK2 sau.
- Kiểm tra tay (Docker, trình duyệt): file 02 + 1 dòng sai vào HK2_2025 → xem trước 29/1, file lỗi "Điểm thi 11 phải từ 0 đến 10", nạp 29, hoàn tác về 0.
- Lưu ý: DB dev của bạn đã CHỐT `HK1_2026` → không nạp được file 03/04/05 vào học kỳ đó (đúng luật, chốt không mở lại).
- Tự kiểm tra: Nhập dữ liệu → Điểm danh tổng hợp → chọn học kỳ còn mở → sửa 1 dòng (VD `co_mat` lớn hơn `tong_buoi`) → nạp → tải file lỗi.

## Phase 4 — Rule engine (2026-10-13)

- Làm: entity `Rule`, `RuleVersion`, `RuleTrigger` (`alertId` NULL, có `evaluationRunId`), `RiskScoreLog`, `EvaluationRun` + 2 migration; seed 10 luật + `RISK-SCORE` (trọng số + tham số dữ liệu chung); evaluator thuần (mỗi luật 1 file + registry, 10 bước, DataStatus, trạng thái/lần học tính theo `asOf`, nhóm LMS theo lớp học phần); RiskScore cộng dồn học phần, chỉ hiển thị; queue `evaluation-run` (lô 200 SV, idempotent khi retry); tự chạy sau nạp/hoàn tác lô; chặn 2 lần chạy cùng phạm vi; tạo phiên bản luật, chạy thử chỉ đọc, chặn kích hoạt khi chưa chạy thử; trang Admin "Chạy đánh giá" + chi tiết lần chạy.
- Gộp sửa lỗi Phase 3: file mẫu `.xlsx`, BOM cho CSV, báo lỗi tên mất dấu; `seed:demo` mở lại học kỳ demo; lệnh `npm run demo:load`.
- Lỗi tìm ra khi viết test: dòng `FINAL` ghi đè ngày công bố điểm giữa kỳ → chạy lại mốc 10/10 mất `ACA-01`; thêm `CourseResult.processPublishedAt` (rule `10`).
- Kiểm tra: typecheck, lint, format, migration, schema drift, test 275 (+1 bỏ qua), coverage rule-engine 92%, build — xanh. Nghiệm thu: HK2 asOf 15/06 đúng 4 trigger, HK1 asOf 10/10 đúng 13 trigger; chạy lại không đổi; thêm dữ liệu sau 10/10 không đổi kết quả mốc 10/10.
- Kiểm tra tay (Docker): `demo:load` → 4 lần chạy tự động; chạy tay HK1 mốc 10/10 trên giao diện → 13 dấu hiệu (2 Rất cao · 5 Cao · 5 Trung bình · 1 Thấp).
- Còn lại (Phase 5): gắn trigger vào Alert, cooldown (đang tạm 168 giờ), thông báo.
- Tự kiểm tra: Admin → Chạy đánh giá → Học kỳ 1 → mốc 2026-10-10 → Chạy đánh giá ngay → so với `docs/demo-data/KET_QUA_MONG_DOI.md`.

## Phase 5 — Cảnh báo, giao diện Cố vấn học tập và sinh viên (2026-10-13)

- Làm: entity `Alert` (1 / sinh viên / học kỳ, CHECK chỉ tham khảo), `AlertStateHistory`, `Intervention`, `Notification` + migration (đưa `cooldown` về 0); gộp trigger vào cảnh báo trong cùng transaction lần chạy (tạo / cập nhật mức / mở lại theo dấu hiệu mới-nặng hơn / mốc cũ chỉ thêm bằng chứng / không còn hiệu lực sau hoàn tác); máy trạng thái + lịch sử + Audit Log; can thiệp (tự sang Đang xử lý, nội dung bảo mật ẩn với Admin); chuyển cảnh báo khi đổi Cố vấn học tập của lớp hoặc sinh viên đổi lớp; thông báo trong ứng dụng + email qua `send-notifications` (chuông, số chưa đọc).
- Giao diện: Cố vấn học tập (danh sách cần xử lý, Sheet chi tiết nhóm 3 nguồn + bằng chứng tải khi mở, ghi can thiệp, đánh dấu đã xem mức Thấp, sinh viên phụ trách, hồ sơ theo học phần); sinh viên ("Tình hình học tập", liên hệ Cố vấn học tập); Admin (cảnh báo chỉ đọc, lọc "chưa có Cố vấn học tập", xem hồ sơ ghi Audit Log); đăng nhập nhanh 2 sinh viên demo.
- Kiểm tra: typecheck, lint, format, migration, schema drift, test 302 (+1 bỏ qua), build — xanh. Nghiệm thu: đúng 12 cảnh báo theo bảng mới của `KET_QUA_MONG_DOI.md`, 12 thông báo + 11 email; chạy lại không tạo trùng; kịch bản mở lại và tăng mức đúng; Admin không xử lý được, Cố vấn học tập khác không xem được, sinh viên chỉ xem của mình.
- Kiểm tra tay (Docker): chạy 2 mốc → 12 cảnh báo, 11 email trong MailHog; GV001 thấy 8 (HK1), GV002 chỉ KHMT2311012; GV001 xử lý KTPM2311003 tới Đã giải quyết; đổi lớp KTPM2311 sang GV002 → GV001 mất quyền ngay (đã trả lại GV001); sinh viên KTPM2311003/001 đăng nhập nhanh thấy đúng trang của mình.
- Lỗi tìm ra khi tự rà: đánh dấu "không còn hiệu lực" sau hoàn tác có thể bắt nhầm cảnh báo chỉ được thêm bằng chứng — đã sửa (chỉ khi sinh viên không còn trigger nào).
- Tự kiểm tra: đăng nhập nhanh "Cố vấn học tập GV001" → Cảnh báo cần xử lý → Xem → Xác nhận đã xem → Lưu can thiệp → Đánh dấu đã giải quyết; MailHog http://localhost:8025; đăng nhập nhanh "Sinh viên KTPM2311003".


## Phase 6 — Quản trị và vận hành (2026-10-13)

- Làm: trang Cấu hình luật (danh sách 10 luật + RISK-SCORE; form ngưỡng tự sinh từ Zod của luật; bản nháp → chạy thử so với bản đang áp dụng + danh sách sinh viên thêm/bớt ≤ 50 → kích hoạt có xác nhận → gợi ý "Chạy đánh giá ngay"; bỏ nháp = `ARCHIVED`; mỗi luật tối đa 1 nháp); "Chạy đánh giá ngay" chọn được học phần, thanh tiến độ, tóm tắt cảnh báo chất lượng dữ liệu; đánh dấu / bỏ đánh dấu rút học phần ở hồ sơ sinh viên (Audit Log); trang tìm sinh viên `/admin/students`; Nhật ký hệ thống (lọc thời gian, hành động, người, đối tượng — chỉ đọc); trang `/legal/privacy-policy` 7 mục (biến `PRIVACY_*`, thiếu → "[Cần nhà trường xác nhận]"); Tổng quan Admin (KPI, biểu đồ Recharts theo mức/lớp, chất lượng nhập liệu, sinh viên chưa đủ dữ liệu); trang "Bắt đầu" 12 bước, tự đánh dấu, khóa bước thiếu dữ liệu.
- Quyết định (ghi rule `00`, `03`, `04`, `05`, `07`, `08`, `09`, `11`): biểu đồ = Recharts + shadcn Chart; ẩn danh hóa HOÃN theo yêu cầu người dùng.
- Kiểm tra: typecheck, lint, format, migration, schema drift, test 338 (+1 bỏ qua), build — xanh. Lưu ý: chạy cả bộ test liền nhau trong < 1 phút có thể vấp giới hạn đăng nhập 5 lần/phút (test đăng nhập đỏ chập chờn), chạy lại sau 1 phút là xanh.
- DoD (Docker, DB rỗng chỉ `seed`, backup `backups/before-phase6-dod-20261013.dump`): làm theo trang "Bắt đầu" trên giao diện — đăng ký GV001/GV002 (xác minh qua MailHog) → duyệt → tạo 2 lớp → 2 học kỳ → nạp 5 file demo (0 lỗi) → chạy HK2 mốc 15/06 (4 dấu hiệu) và HK1 mốc 10/10 (13 dấu hiệu) → GV001 thấy 3 + 8 cảnh báo, GV002 chỉ KHMT2311012. Không sửa DB tay.
- Còn lại (Phase 7): bảo mật, hiệu năng, backup/restore, responsive/dark mode, kịch bản demo.
- Tự kiểm tra: Admin → Bắt đầu; Cấu hình luật → ATT-03 → sửa "Số lần đi trễ từ" = 1 → Lưu bản nháp → Chạy thử (mốc 2026-10-10) → xem 3 sinh viên thêm vào → Bỏ bản nháp; Sinh viên → tìm KTPM2311003 → Đánh dấu đã rút; Nhật ký hệ thống → lọc "Đánh dấu rút học phần".

## Phase 7 — Hoàn thiện và demo (2026-10-15)

- Sửa logic (chốt với người dùng): chạy theo 1 học phần không hạ mức; cảnh báo lưu "dấu hiệu hiện tại" (`currentTriggerIds`) — điểm danh quá hạn thì GIỮ dấu hiệu cũ, không hạ mức; hết dấu hiệu → nhãn "Lần đánh giá gần nhất không còn dấu hiệu" (không tự đóng); lịch chạy mỗi đêm `SCHEDULED` (tắt khi demo); demo không tự chạy sau nạp; bộ lọc Khoa (Tổng quan, cảnh báo Admin, chọn học phần). 2 migration (sao lưu trước khi chạy).
- Bảo mật: rà STRIDE + checklist `06` (`docs/bao-cao/01`), thêm header bảo mật, sinh `AUTH_SECRET` mới, `STAFF_EMAIL_DOMAIN=@ctuet.edu.vn`; `npm audit` 0 high/critical (6 moderate gián tiếp qua exceljs/minio).
- Hiệu năng (`docs/bao-cao/02`, DB `ewars_perf`): 5.000 SV, đánh giá cả học kỳ ~22 giây; mọi danh sách < 110 ms → giữ phân trang hiện tại. Sao lưu/khôi phục `npm run backup|restore`, diễn tập khớp 100% số dòng, khôi phục 5.000 SV 3,7 giây (`docs/bao-cao/03`).
- Demo: `README.md` (máy sạch, TLS, Google OAuth, đặt lịch sao lưu), `npm run demo:reset -- --yes [--evaluate]`, 8 kịch bản nhỏ `docs/demo-data/kich-ban/` + `npm run demo:scenario -- <số>`, `docs/demo-script.md` (10 phút + "hội đồng hỏi gì → mở gì"), 40 ảnh `docs/screenshots/` (`npm run screenshots`, 0 trang tràn ngang).
- Kiểm tra: typecheck, lint, format, migration, test 356 (gồm 8 kịch bản nghiệm thu), độ phủ rule-engine 91,4% / data-import 89,2% / khác ≥ 60%, Playwright 2/2, build — xanh (`docs/bao-cao/04`).
- Kiểm tay (Docker): `demo:reset --evaluate` → đúng 12 cảnh báo; GV001/GV002/sinh viên; cấu hình luật chạy thử; kịch bản 02 nạp qua worker → đúng 7 cảnh báo.
- DoD máy sạch: clone mới từ GitHub → làm đúng README (npm ci, docker compose up --build, db:init, migration:run, seed, demo:reset --evaluate) trên stack Docker riêng → đúng 12 cảnh báo, Playwright 2/2, kịch bản 08 nạp 2 đợt đúng kết quả.
- Còn lại: ẩn danh hóa sinh viên (hoãn); TLS/Google OAuth khi triển khai thật.
- Tự kiểm tra: `npm run demo:reset -- --yes` → làm theo `docs/demo-script.md`; `npm run demo:scenario -- 8 --evaluate` rồi đọc `docs/demo-data/kich-ban/08-vong-doi-canh-bao/README.md`.

## Phase 8a — Điều chỉnh theo dữ liệu thật của trường (2026-10-19)

- Căn cứ: `docs/doi-soat-du-lieu-truong.md` (ảnh hệ thống trường + Quy chế 336). Rules `00`, `08`–`12` viết lại; 12 luật: ATT-01/02 (theo tiết), LMS-01–04 (trắc nghiệm + bài thực hành có hạn nộp), ACA-01–04 (Điều 11, A = 3,8, ACA-04 so học kỳ trước), COMB-01/02. Bỏ ATT-03 và điểm giữa kỳ.
- Dữ liệu: sao lưu `backups/before-phase8a-20261018.dump` rồi migration làm sạch; bảng mới `lms_activities`, `lms_assignment_submissions`; điểm danh theo tiết; kết quả có được dự thi / vắng thi; `Enrollment.sectionCode`; chốt học kỳ = lần chạy `TERM_CLOSING` rồi mới `closedAt`.
- Nhập: 5 mẫu file mới, mã học phần tự suy từ mã lớp học phần, cảnh báo sai tên / đổi hạn nộp / lệch thang điểm 4, chọn học phần tùy chọn (`COURSE_MISMATCH`), thẻ nhận diện học phần ở màn xem trước, tự tìm dòng tiêu đề.
- Demo v2: lớp KTPM2411, 20 SV giả, 3 môn, HK1 2025–2026, 3 mốc → 10/13/16 cảnh báo (`KET_QUA_MONG_DOI.md`). Demo cũ + 8 kịch bản lưu ở `_luu-tru-v1/` (viết lại Phase 9).
- Kiểm tra: typecheck, lint, format, migration:check, 365 test, build — xanh. Kiểm tay 3 mục DoD đạt. Playwright chưa sửa (8b).
- Tự kiểm tra: `npm run demo:reset -- --yes --evaluate=2` → Admin → Nhập dữ liệu → mở lô điểm danh (thẻ học phần, cảnh báo sai tên) → GV001 xem KTPM2411908 (LMS-03) → Admin → Học kỳ → Chốt học kỳ (mốc 2025-12-31).

## Phase 8b — Nền tảng giao diện dùng chung (2026-10-19)

- Kế hoạch giao diện chia 8b–8f (`docs/implement.md`); giữ shadcn, thêm `pagination`, `breadcrumb`, `command` (cmdk), `popover`, `progress`, `collapsible`, `scroll-area`.
- Phân trang + sắp xếp phía server (`src/lib/list-params.ts`, `DataPagination`, cột `meta.sortKey`): tài khoản, sinh viên, lô nhập, dòng lỗi, lần chạy đánh giá, cảnh báo Admin (trước giới hạn 500), nhật ký. Cỡ trang 20/50/100, giữ bộ lọc, trang vượt quá có nút về trang cuối.
- `DataTable`: < 768px mỗi dòng thành thẻ. Menu gom 4 nhóm (Admin), 768–1023px thu thành biểu tượng. `loading.tsx`/`error.tsx`/`not-found.tsx` cho 3 khu vực + gốc; `EmptyState`; breadcrumb thay nút "Quay lại"; nút "?" mở đúng bước trang Bắt đầu.
- Tìm nhanh Ctrl+K (Admin, CVHT): MSSV/họ tên gõ không dấu, CVHT chỉ lớp mình, 60 lần/phút; đo 20 ms / 5.000 SV (`ewars_perf`, không cần index). Toast lỗi giữ 10 giây (`@/lib/notify`).
- Rules: `03` (thành phần, phân trang, thẻ điện thoại, menu), `07` (tải/lỗi/trống, Ctrl+K, breadcrumb, nút "?").
- Kiểm tra: typecheck, lint, format, migration:check, 376 test, build — xanh. Kiểm tay trên trình duyệt đạt (xem `implement.md`); chưa thử tắt DB để xem trang lỗi.
- Tự kiểm tra: Admin → Nhật ký hệ thống → đổi trang / số dòng / bấm tiêu đề cột; Ctrl+K gõ "le van cuong"; thu nhỏ cửa sổ < 768px xem bảng thành thẻ.

## Phase 8c — Trang quản trị (2026-10-19)

- Rà trước khi code, người dùng chốt: họ tên sắp theo tên rồi họ; RiskScore giữ 0–1 + thanh; danh mục khoa = chip lọc + mục thu gọn.
- Bắt đầu: tài liệu hướng dẫn 4 phần, mỗi bước "Làm gì / Vì sao cần / Cần chuẩn bị (file mẫu)", thanh tiến độ, bước tiếp theo, mục lục, hỏi đáp; thêm bước "Xem lại luật cảnh báo" (nội dung `getting-started-content.ts`).
- Tài khoản: cột Lớp (CVHT: lớp phụ trách + sĩ số, "Chưa gán lớp"; sinh viên: lớp), lọc "CVHT chưa gán lớp", thẻ đếm chờ duyệt / hoạt động / bị khóa bấm để lọc.
- Khoa và lớp: chip khoa (số lớp, SV), bảng phẳng phân trang (khóa mới trước, cột cảnh báo đang mở), tìm + lọc khóa / chưa có CVHT, ô chọn CVHT có tìm kiếm; danh mục khoa thu gọn.
- Kết quả đánh giá: 1 bảng theo sinh viên (SQL tổng hợp, phân trang DB, bỏ giới hạn 500), mở dấu hiệu trong dòng, lọc có dấu hiệu / mức / lớp / luật. Bảng luật dạng thẻ trên điện thoại.
- Rules `03`, `07`. Kiểm tra: typecheck, lint, format, migration:check, 378 test, build — xanh; kiểm tay đạt (xem `implement.md`).
- Tự kiểm tra: Admin → Bắt đầu; Tài khoản → lọc Cố vấn học tập; Khoa và lớp → bấm chip khoa, "Đổi Cố vấn" gõ tìm; Chạy đánh giá → mở 1 lần chạy → bấm "N dấu hiệu".

## Phase 8d — Hai trang tổng quan (2026-10-19)

- Rà trước khi code, người dùng chốt: xu hướng theo các lần đánh giá (mốc dữ liệu), học phần chậm dữ liệu so với ngày dữ liệu mới nhất của học kỳ.
- Service dùng chung `alerts/services/dashboard.service.ts` (+ `advisor-dashboard.service.ts`): tóm tắt cảnh báo, diễn biến, nguồn, học phần, lớp × mức; Admin thêm độ mới dữ liệu, lô lỗi, lớp chưa có CVHT, nhắc thiết lập (`overview.service.ts` viết lại).
- Tổng quan Admin: dải Cần chú ý, 4 thẻ số, tiến độ xử lý + theo mức, biểu đồ diễn biến, nguồn, top học phần, bảng lớp × mức, độ mới dữ liệu; chọn học kỳ + khoa. Mọi khối bấm sang danh sách đã lọc.
- Tổng quan CVHT (`/advisor`): cần chú ý (chờ xác nhận, quá 7 ngày, hẹn theo dõi), 4 thẻ, theo mức / nguồn, lớp phụ trách, 5 SV cần chú ý, diễn biến, hẹn đến hạn, hoạt động gần đây. Danh sách cảnh báo chuyển `/advisor/alerts` (email, chuông, link cũ chuyển hướng).
- Hiệu năng: tạo lại `ewars_perf` theo cấu trúc 8a, đo lại toàn bộ (`docs/bao-cao/02`): tổng quan ≤ 76 ms.
- Kiểm tra: typecheck, lint, format, migration:check, 385 test, build — xanh; kiểm tay Admin + GV001, điện thoại, chế độ tối.
- Tự kiểm tra: Admin → Tổng quan → bấm mục trong "Cần chú ý" / ô bảng lớp × mức; đăng nhập GV001 → Tổng quan → bấm "Cần xử lý".

## Phase 8e — Màn hình CVHT và sinh viên (2026-10-19)

- Rà trước khi code, người dùng chốt: ma trận sinh viên × học phần; dòng thời gian = cảnh báo + can thiệp (chỉ loại) + ngày chốt dữ liệu. Vạch vắng đọc từ ATT-01 đang áp dụng.
- Danh sách cảnh báo (CVHT + Admin): phân trang server, lý do = dấu hiệu nặng nhất, nhãn quá 7 ngày, lọc từ khóa / lớp / mức / nguồn / trạng thái; xuất `.xlsx` + CSV (`/api/alerts/export`, `src/lib/spreadsheet.ts`, Audit Log `ALERT_EXPORT`).
- Thông báo: trang `/advisor/notifications` (tất cả / chưa đọc, đánh dấu từng cái / tất cả), chuông không tự đánh dấu hết, có "Xem tất cả".
- Ma trận `/advisor/matrix` (`class-matrix.service.ts`); hồ sơ sinh viên thêm mức theo nguồn, biểu đồ vắng, ĐTB các học kỳ, dòng thời gian (`student-insights.service.ts`, `rule-engine/services/student-academic.service.ts`).
- Trang sinh viên: thẻ từng học phần với thanh vắng so với vạch, bỏ nhãn "Ổn định"; thẻ "Lần đầu dùng?" cho CVHT và sinh viên.
- Rules `06`, `07`. Kiểm tra: typecheck, lint, format, migration:check, 395 test, build — xanh; kiểm tay GV001 + sinh viên, điện thoại.
- Tự kiểm tra: GV001 → Cảnh báo cần xử lý → lọc + Xuất Excel; Ma trận lớp → bấm 1 ô; mở 1 sinh viên → biểu đồ vắng; đăng nhập sinh viên KTPM2411903 → thẻ học phần.

## Phase 8f — Nạp nhiều file và chốt giao diện (2026-10-20)

- Rà trước khi code, người dùng chốt: 1 lô thật nhiều file (không "nhóm lô"), tối đa 50 file / lô, bảng độ mới theo cách của 8d.
- Nạp nhiều file: bảng mới `import_batch_files` + `import_error_rows.source_file_name` (migration `Phase8fImportFiles`, điền 1 dòng cho lô cũ); tải lên lần lượt từng file (`beginImportUpload` / `addImportFile` / `finishImportUpload`, trạng thái `UPLOADING`); xử lý đọc lần lượt các file, trùng khóa xuyên file, trần 50.000 dòng cả lô; rate-limit 30 lô / giờ.
- Giao diện nhập: kéo thả nhiều file, thanh tiến độ tải lên; xem trước có bảng từng file, dòng lỗi / cảnh báo ghi tên file; file lỗi thêm cột `ten_file`; lịch sử lọc loại / học phần / khoa; bảng "Học phần nào cần nạp dữ liệu" (`getDataFreshness` thêm từng học phần).
- Playwright 2 luồng viết lại theo demo v2; `npm run screenshots` 22 trang (62 ảnh); `docs/demo-script.md` viết lại; README mục 6 ảnh; demo `docs/demo-data/nhieu-file/`.
- Rà 3 khổ + tối + bàn phím: sửa tràn ngang form luật (bảng mức cảnh báo).
- Rules `07`, `12`. Kiểm tra: typecheck, lint, format, migration:check, 402 test, build, e2e (cả image Docker) — xanh.
- Tự kiểm tra: Admin → Nhập dữ liệu → loại "Điểm danh" → kéo 3 file trong `docs/demo-data/nhieu-file/` → xem bảng từng file → Hủy lô; xem bảng "Học phần nào cần nạp dữ liệu"; lọc lịch sử theo học phần.

## Phase 9a — Danh mục Ngành, 5 lớp, tài khoản demo (2026-10-22)

- Rà trước (người dùng chốt, đối chiếu chương trình khung KTPM2311): toàn Khoa CNTT khóa 2024, 5 lớp theo mẫu `KTPM2411`, danh mục Ngành, mỗi lớp 1 CVHT, làm lại KTPM theo HK4 thật (9b), GDTC/GDQP bỏ qua. Kế hoạch 9a/9b/9c ở `implement.md`.
- Bảng `majors` + `administrative_classes.major_id` (migration `Phase9aMajors`), seed 5 ngành; lớp chọn ngành cùng khoa (`MAJOR_DEPARTMENT_MISMATCH`, `MAJOR_NOT_FOUND`).
- Lọc Ngành: Khoa và lớp (cột + lọc), Tổng quan Admin, Cảnh báo sớm (+ xuất file), Sinh viên (`DashboardScope.majorId`, `MajorFilter`).
- Seed demo: 5 lớp, GV001–GV005, học kỳ `HK3_2024` + `HK1_2025`; đăng nhập nhanh Admin + 5 CVHT + 5 SV gom theo lớp (`src/lib/demo-accounts.ts`).
- Rules `06`, `07`, `08`, `09`; `KET_QUA_MONG_DOI.md` (dữ liệu nền), `demo-script.md` cập nhật theo seed mới.
- Kiểm tra: typecheck, lint, format, migration:check, 406 test, build, e2e — xanh.
- Tự kiểm tra: Admin → Khoa và lớp → lọc Ngành; Tạo lớp → chọn khoa CNTT → chọn ngành; Tổng quan → ô Ngành; trang đăng nhập → tab Cán bộ → nút theo lớp.

## Phase 9b — Bộ demo v3 + nghiệm thu (2026-10-23)

- Rà rủi ro giả định trước (người dùng chốt): SV KHDL chuyển đến, ghi `ma_hoc_phan` ở file học lại / HK3, SV sạch theo thiết kế, vòng đời chỉ trong test + thao tác tay, 3–4 học phần / lớp.
- `KET_QUA_MONG_DOI.md` v3 (5 lớp × 1 chủ đề, học phần HK4 thật, `HK3_2024`) viết và duyệt trước; bộ v2 + `nhieu-file` lưu `_luu-tru-v2/`.
- `gen_demo_v3.py`: 100 SV, 1 file / lớp học phần / nguồn (30 + 32 + 10 + 9 + 4 + 12 file), `minh-hoa-loi/`; `demo:load` nạp mỗi thư mục thành 1 lô nhiều file.
- Test nghiệm thu mới `demo-v3-acceptance.test.ts` (helper `tests/helpers/demo-v3.ts`): khớp 100% bảng tính tay ngay lần đầu; test tính năng cũ giữ fixture v2.
- Kiểm tra: typecheck, lint, format, migration:check, 415 test, build — xanh; `demo:reset --evaluate` 24 → 29 → 35.
- Phát hiện: `npm audit` báo Next.js 16.4.0 có lỗ hổng critical (RCE Image Optimization, DoS Server Actions) — chưa nâng cấp, chờ người dùng quyết.
- Tự kiểm tra: `npm run demo:reset -- --yes --evaluate=2` → đăng nhập nhanh từng CVHT GV001–GV005 → Cảnh báo cần xử lý; sinh viên `<lớp>903`.
