# 06 — Bảo mật

Xem `00-project-context.md` cho glossary và bảng phạm vi role.

## Xác thực (Better Auth)

- MUST: dùng cơ chế hash mặc định của Better Auth — MUST NOT tự viết hàm hash mật khẩu riêng.
- MUST: session hết hạn sau thời gian không hoạt động hợp lý (khuyến nghị 8 giờ phiên thường, tối đa 30 ngày cho "remember me").
- MUST: đăng nhập thất bại nhiều lần liên tiếp bị rate-limit và ghi Audit Log. Cài đặt: rate-limit của Better Auth lưu bảng `auth.rateLimit` (`/sign-in/email` 5 lần/phút); mỗi lần sai ghi `LOGIN_FAILED`; Google bị từ chối ghi `SIGN_IN_REJECTED`; form đăng ký CVHT 5 lần/giờ/IP (Redis).
- MUST: Google OAuth của sinh viên kiểm tra ở SERVER: email đã xác minh (`email_verified`) VÀ kết thúc `@student.ctuet.edu.vn` VÀ khớp 1 `User` `role = STUDENT` đã được Admin nhập. Thiếu 1 trong 3 → từ chối, không tạo phiên. Tham số `hd` của Google chỉ là gợi ý giao diện, MUST NOT dùng làm kiểm tra.
- MUST: form đăng ký CVHT luôn tạo `role = ADVISOR`, `accountStatus = PENDING_APPROVAL` — MUST NOT nhận `role` từ client; MUST NOT có đường tự đăng ký `ADMIN`. Email MUST đúng `STAFF_EMAIL_DOMAIN` và đã xác minh. Rate-limit form đăng ký. Tạm thời (người dùng yêu cầu, vì chưa có email trường để thử): `STAFF_EMAIL_DOMAIN=*` nhận mọi email trừ email sinh viên — MUST đặt lại `@ctuet.edu.vn` khi triển khai thật. Email sinh viên KHÔNG BAO GIỜ được dùng cho tài khoản cán bộ, kể cả khi là `*`.
- MUST: `DEMO_MODE=true` mới bật: nút đăng nhập nhanh tài khoản mẫu, điền sẵn tài khoản demo ở `/login`, chọn mốc `asOf` trong quá khứ khi chạy đánh giá. Kiểm tra ở server (trả 403 khi tắt), không chỉ ẩn nút — cài thành endpoint Better Auth `POST /api/auth/demo/quick-login` (plugin trong `src/lib/auth.ts`), tạo phiên bằng Better Auth, ghi Audit Log `DEMO_QUICK_LOGIN`. Mật khẩu tài khoản seed đọc từ `ADMIN_SEED_PASSWORD` — MUST NOT ghi cứng trong code hay tài liệu.
- MUST: mọi truy vấn dữ liệu kiểm tra `accountStatus = ACTIVE`; tài khoản `PENDING_APPROVAL`/`REJECTED`/`SUSPENDED` chỉ thấy trang thông báo trạng thái.

## Phân quyền theo phạm vi (Scope-based Authorization) — không thương lượng

- MUST: kiểm tra quyền ở tầng Server Action/Route Handler cho MỌI thao tác đọc/ghi dữ liệu sinh viên — MUST NOT chỉ dựa vào việc ẩn UI. Gọi hàm dùng chung:
  ```ts
  await assertScope(session.user, { studentId, resourceType: 'Alert' })
  ```
- MUST: áp dụng đúng ma trận phạm vi trong `00-project-context.md` (`STUDENT` chỉ xem chính mình; `ADVISOR` chỉ sinh viên thuộc lớp sinh hoạt có `advisorId` là mình — suy ra qua `Student.classId → AdministrativeClass.advisorId`, MUST NOT đọc từ cột lưu lặp ở `Student`; `ADMIN` toàn quyền vận hành, đọc được mọi cảnh báo nhưng KHÔNG xử lý `Alert` và KHÔNG có quyền ghi `officialAcademicStatus`).
- MUST: dùng UUID cho mọi tài nguyên nhạy cảm (`Alert`, `Intervention`) — MUST NOT dùng ID tuần tự dễ đoán (chống IDOR).

## Checklist STRIDE khi code từng module

| Đe dọa | Việc phải làm |
|---|---|
| Spoofing | Dùng session token ký bởi Better Auth — MUST NOT tự chế cookie/token thủ công |
| Tampering | Mọi thay đổi `RuleVersion` qua Server Action có validate + Audit Log — MUST NOT cho sửa DB trực tiếp qua công cụ ngoài ở production |
| Repudiation | Mọi thay đổi trạng thái `Alert` ghi Audit Log đầy đủ actor + timestamp — không cho xóa bản ghi này |
| Information Disclosure | MUST có test tự động xác nhận CVHT A không truy vấn được dữ liệu sinh viên thuộc CVHT B |
| Denial of Service | Rate-limit import file; giới hạn kích thước file upload (khuyến nghị tối đa 20MB) |
| Elevation of Privilege | MUST NOT có endpoint nào tự nâng `role` của chính người gọi — đổi vai trò chỉ qua module `admin`, có Audit Log |

## Audit Logging — append-only, bắt buộc

- MUST NOT: expose bất kỳ Server Action nào `UPDATE`/`DELETE` bảng `AuditLog`. Nếu cần "xóa" theo yêu cầu pháp lý, dùng ẩn danh hóa (xem `04-legal-compliance.md`).
- MUST: ghi Audit Log cho: cấu hình luật, mỗi lần tạo `EvaluationRun` thủ công (ai, phạm vi), duyệt/từ chối/khóa tài khoản, gán hoặc đổi CVHT của lớp sinh hoạt, tạo học kỳ/đổi học kỳ hiện tại/chốt học kỳ, đổi trạng thái `Alert`, truy cập hồ sơ chi tiết 1 sinh viên bởi người không phải CVHT phụ trách trực tiếp, mọi thao tác `ImportBatch` (tạo/hủy/nhập lại), đăng nhập thất bại, thay đổi vai trò tài khoản.
- MUST: dùng đúng 1 hàm `writeAuditLog()` trong `lib/audit.ts`, gọi từ mọi nơi liên quan — MUST NOT copy-paste logic ghi log ở nhiều chỗ.

## Bảo vệ dữ liệu khi lưu trữ và truyền tải

- MUST: TLS cho mọi kết nối: trình duyệt–app, app–PostgreSQL, app–SMTP, worker–Redis (nếu Redis không nằm trong mạng Docker nội bộ tin cậy).
- MUST NOT: commit biến môi trường bí mật (`DATABASE_URL`, `SMTP_PASSWORD`, `AUTH_SECRET`) vào Git — dùng `.env.local` (gitignore) cho dev, secret manager cho production.

## Bảo mật tầng ứng dụng web

- MUST: tận dụng bảo vệ CSRF mặc định của Server Actions (same-origin check) — MUST NOT tắt.
- MUST NOT: dùng `dangerouslySetInnerHTML` cho bất kỳ dữ liệu nào có nguồn gốc từ người dùng nhập (`Intervention.content`, `RuleTrigger.reason` nếu cho nhập tự do).
- MUST: dùng repository/`QueryBuilder` của TypeORM với tham số (`:name` + `setParameters`) cho mọi truy vấn. Nếu buộc dùng `dataSource.query()`, MUST truyền tham số dạng mảng (`$1`, `$2`) — MUST NOT nối chuỗi SQL thủ công.
- MUST: kiểm tra MIME type + đuôi file + giới hạn kích thước trước khi xử lý file upload — MUST NOT tin tưởng đuôi file người dùng đặt.

## Thông báo và email sinh viên

- MUST: địa chỉ email của `STUDENT` kết thúc bằng `@student.ctuet.edu.vn` — validate bằng Zod ở mọi điểm vào (import CSV, tạo tài khoản) và ràng buộc ở DB (xem `09-data-schema-identity.md`).
- MUST: gửi thông báo khi `Alert` được tạo mới, chuyển `REOPENED`, hoặc `severity` tăng — chạy lại đánh giá mà cảnh báo không đổi mức thì KHÔNG gửi. `LOW`: chỉ `IN_APP`, không gửi email; `MEDIUM`/`HIGH`/`CRITICAL`: `IN_APP` + `EMAIL` gửi ngay. Không có chống gửi trùng / giới hạn tần suất (người dùng quyết định bỏ). Kênh chỉ gồm `EMAIL` và `IN_APP`.
- MUST NOT: đưa `inputSnapshot` thô hoặc nội dung `Intervention` mức `SENSITIVE` vào nội dung email.

## Dependency & Container

- MUST: chạy `npm audit --omit=dev --audit-level=high` trong CI, chặn merge nếu dependency production có lỗ hổng mức `high`/`critical`. Lỗ hổng chỉ nằm trong devDependencies (công cụ lint/test, không vào image production) mà chưa có bản vá: ghi vào `PROGRESS.md`, kiểm tra lại mỗi phase.
- MUST: build Docker image multi-stage, MUST NOT chạy container với user `root`, image production không chứa devDependencies.
