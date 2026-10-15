# Bài học từ dự án cũ (CTUT-EWARS, làm bằng Antigravity)

Đọc trước Phase 0. Dự án cũ đã làm xong Phase 0–6 và bước A1–A4 (107 test xanh), nhưng phải dừng để làm lại vì **mô hình dữ liệu đổi 3 lần trong lúc code**. Mọi quyết định cuối cùng đã nằm trong `docs/rules/`; file này giải thích *vì sao*, và chỉ ra phần code cũ đáng tham khảo.

## 1. Vì sao làm lại

| Vấn đề ở dự án cũ | Hậu quả | Cách dự án mới tránh |
|---|---|---|
| Thiết kế dữ liệu nguồn chi tiết (lịch từng buổi, danh sách bài tập, nhật ký LMS) trước khi biết trường xuất được gì | Phải đập 8 bảng và 6 luật khi chuyển sang 3 nguồn tổng hợp | Chốt 3 nguồn + mẫu CSV + bộ dữ liệu demo TRƯỚC khi code (đã có trong `docs/demo-data/`) |
| CVHT gán theo từng sinh viên | Migration dữ liệu lớn khi chuyển sang lớp sinh hoạt | CVHT gán theo lớp sinh hoạt ngay từ Phase 1 |
| Tự tạo hồ sơ sinh viên khi đăng nhập Google, lấy mã từ phần đầu email (`tmthuanktpm2311019`) | Lỗ hổng bảo mật + dữ liệu rác | Cấm auto-provisioning (`01`, `06`, `09`); test từ Phase 1 |
| Nút đăng nhập nhanh và mật khẩu Admin `123123123` ghi cứng | Cửa hậu nếu đưa lên máy thật | `DEMO_MODE` kiểm tra ở server; mật khẩu từ biến môi trường |
| Đăng ký học phần, lớp học phần, lịch học là các file nhập riêng | Admin phải nạp 3 file trước khi có dữ liệu học tập | `Enrollment` tự sinh từ dữ liệu nguồn |
| Báo cáo tiến độ dài (file tổng hợp > 110 KB) và luôn "PASS 100%" | Khó đọc; test xanh nhưng nghiệp vụ vẫn sai | `PROGRESS.md` ≤ 15 dòng mỗi phase; DoD có kiểm tra tay; test nghiệm thu so với kết quả mong đợi |

## 2. Giữ / Đổi / Bỏ

| | Nội dung |
|---|---|
| **Giữ nguyên ý tưởng** | Stack (Next.js 16, TypeORM, Better Auth schema `auth` riêng, BullMQ, MinIO, Tailwind 4 + shadcn); theme trắng + xanh dương; 3 role; duyệt CVHT; Google OAuth sinh viên; `assertScope()`; Audit Log append-only; `Alert` + máy trạng thái + `Intervention` + `Notification`; `RuleVersion` + dry-run; `EvaluationRun` 2 đường kích hoạt; registry luật; 2 tầng `DataStatus`/`DataCompletenessLevel`; học kỳ hiện tại bằng partial unique index; trang chính sách dữ liệu, ẩn danh hóa |
| **Đổi** | Bộ luật 6 → 10 luật trên 3 nguồn (`08`); `Enrollment` = sinh viên × học phần × học kỳ, tự sinh; mã luật `HR-ATT-01` → `ATT-01`; `EvaluationRun` có `asOf`; `CourseResult` có `publishedAt`; danh sách hay mở rộng lưu `varchar` thay vì enum Postgres |
| **Bỏ** | `CourseSection`, `CourseSessionSchedule`, `SectionMeetingPattern`, `AttendanceRecord`, `AssessmentResult`, `LMSAssignment`, `LMSSubmission`, `LMSActivityEvent`, `LMSDeadlineExtension`; nhập `ENROLLMENT`/`COURSE_SECTION`; cột `Student.advisorId`; cột `accountStatus` trong bảng `auth.user` |

## 3. Sự cố kỹ thuật đã gặp → quy tắc trong rules

| Sự cố | Nguyên nhân | Quy tắc |
|---|---|---|
| `PROVIDER_NOT_FOUND` khi bấm đăng nhập Google | Thiếu `GOOGLE_CLIENT_ID/SECRET` nên provider không được đăng ký | `01`: chỉ đăng ký provider khi có biến; ẩn nút Google khi thiếu |
| `duplicate key` khi sinh viên đăng nhập lần đầu | Layout và Page cùng gọi `getCurrentUser()` song song, cùng INSERT | `01`: `React.cache()`; hàm chỉ đọc |
| Mọi lỗi Google đều hiện "sai tên miền" | Lỗi ném `Error` thường bị Better Auth gộp; `errorCallbackURL` gán cứng `?error=invalid_domain` | `01`: ném `APIError` với 4 mã cố định; `errorCallbackURL = /login` |
| "Only plain objects… can be passed to Client Components" (đăng ký CVHT, tạo lớp) | Server Action trả instance entity TypeORM | `01`: Server Action trả DTO qua hàm map |
| Sĩ số lớp hiện 0 dù đã nạp 75 sinh viên | `loadRelationCountAndMap` + `leftJoinAndSelect` không chạy subquery | `01`: đếm bằng `COUNT ... GROUP BY` tường minh |
| CI đỏ: thiếu `uuid-ossp`, schema `auth`; TypeORM CLI lỗi ESM khi glob migration | Môi trường CI rỗng; glob path động | `01`: `db:init` trước migration; import migration trực tiếp; thứ tự CI cố định |
| Mỗi lần thêm loại nhập phải viết migration `ALTER TYPE ... ADD VALUE` | Dùng enum Postgres cho danh sách hay mở rộng | `01`: danh sách hay mở rộng dùng `varchar` + Zod |
| Danh mục khoa sai (6 khoa tự đặt, sau sửa thành 7) | AI tự bịa danh mục | `09`: danh sách 7 khoa chính thức do người dùng cung cấp |
| Màn nhập hiện "(00, 10, 12)", `ImportErrorRow`, SHA-256 cho người dùng | Lời văn lấy từ tài liệu kỹ thuật | `07`: cấm thuật ngữ nội bộ trên giao diện |
| Thêm cột vào bảng `auth.user` của Better Auth | Muốn đồng bộ trạng thái vào session | `01`: không đụng bảng `auth`; trạng thái chỉ ở `public.users` |

## 4. Bài học quy trình

1. **Dữ liệu trước, code sau.** Mọi thay đổi lớn ở dự án cũ đều do dữ liệu đầu vào chưa chốt. Dự án mới có sẵn mẫu CSV và bộ dữ liệu demo; nếu nguồn thật khác mẫu, sửa `10`, `12` và `docs/demo-data/` trước.
2. **Một phase một lần, kiểm tra tay rồi mới commit.** Bước nào cũng mở giao diện thử như người dùng thật.
3. **Test xanh ≠ đúng nghiệp vụ.** Test nghiệm thu so với `KET_QUA_MONG_DOI.md` (do người tính độc lập) mới chứng minh luật chạy đúng.
4. **Backup trước migration đổi bảng có dữ liệu** (`backups/`, đã gitignore).
5. **Không để AI tự bịa danh mục thật** (khoa, email trường, quy chế): hỏi người dùng.

## 5. Code cũ đáng tham khảo (chỉ đọc, viết lại theo rules mới — không copy nguyên khối)

Thêm thư mục dự án cũ vào phiên Claude Code (VD: `/add-dir ../CTUT-EWARS`) rồi đọc khi làm phase tương ứng:

| Phase | File cũ | Lấy gì |
|---|---|---|
| 0 | `src/app/globals.css`, `src/app/layout.tsx`, `src/components/layout/app-shell.tsx`, `src/app/design-check/page.tsx` | Token màu, font, khung giao diện |
| 0 | `docker-compose.yml`, `Dockerfile`, `Dockerfile.worker`, `.github/workflows/ci.yml`, `scripts/ci-init-db.ts`, `scripts/run-migrations.ts`, `src/db/data-source.ts`, `src/lib/env.ts` | Cấu hình đã chạy được trên CI |
| 1 | `src/lib/auth.ts` (hook sau bước A1), `src/lib/auth-server.ts`, `src/lib/authz.ts`, `src/app/login/page.tsx`, `src/app/no-profile/page.tsx`, `src/app/pending-approval/page.tsx` | Luồng đăng nhập đã sửa lỗi |
| 2 | `src/modules/admin/services/term-management.service.ts`, `class-management.service.ts`, `src/app/admin/terms/`, `src/app/admin/classes/` | Học kỳ hiện tại, đổi CVHT lớp trong transaction |
| 3 | `src/modules/data-import/services/csv-parser.ts`, `csv-import.service.ts` | Chuẩn hóa header tiếng Việt, xuất file lỗi |
| 4 | `src/modules/rule-engine/evaluator/` (cấu trúc registry), dry-run service, evaluation-run service | Khung engine — luật viết lại theo `08` |
| 5 | `src/modules/alerts/services/alert-lifecycle.service.ts`, notification service | Máy trạng thái (bỏ phần debounce thông báo — dự án mới không chống gửi trùng) |
| 6 | `src/app/legal/privacy-policy/`, `src/lib/audit.ts`, chức năng ẩn danh hóa | Trang pháp lý, Audit Log |

KHÔNG mang sang: entity và test của các bảng bị bỏ ở mục 2; 6 luật `HR-*`; các migration cũ (dự án mới bắt đầu từ migration gốc mới); seed sinh viên `2100001…`.
