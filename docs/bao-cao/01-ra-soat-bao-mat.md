# Rà soát bảo mật (Phase 7, 2026-10-15)

Đối chiếu `docs/rules/06-security.md`. Cột "Bằng chứng" chỉ file/test kiểm được.

## STRIDE

| Đe dọa | Biện pháp đã có | Bằng chứng |
|---|---|---|
| Spoofing (giả mạo) | Phiên do Better Auth ký, cookie httpOnly; không tự chế token. Sinh viên chỉ Google + email `@student.ctuet.edu.vn` đã xác minh + có hồ sơ; cán bộ email/mật khẩu, phải xác minh email và được duyệt | `src/lib/auth.ts`, `src/lib/auth-policy.ts`, `tests/integration/auth-sign-in.test.ts`, `tests/unit/auth-policy.test.ts` |
| Tampering (sửa trái phép) | Mọi thay đổi luật qua Server Action + Zod + phiên bản mới (không ghi đè) + Audit Log; dữ liệu nhập qua 2 bước xem trước → xác nhận | `src/modules/rule-engine/actions/rule.actions.ts`, `rule-config.service.ts` |
| Repudiation (chối bỏ) | Audit Log chỉ ghi thêm (không có hàm sửa/xóa), đủ actor + thời điểm; trang Nhật ký hệ thống chỉ đọc | `src/lib/audit.ts`, `/admin/audit-logs` |
| Information disclosure (lộ dữ liệu) | `assertScope()` theo lớp sinh hoạt; Cố vấn học tập A không xem được sinh viên của B; sinh viên chỉ thấy cảnh báo của mình sau khi được xác nhận; can thiệp "nhạy cảm" ẩn với Admin; email không chứa số liệu thô | `src/lib/authz.ts`, `tests/integration/authz-scope.test.ts`, `tests/integration/alerts.test.ts` |
| Denial of service | Giới hạn đăng nhập 5 lần/phút, đăng ký 5 lần/giờ/IP, tải file có rate-limit; file ≤ 20MB, ≤ 50.000 dòng, chống zip bomb; job nền giới hạn concurrency | `src/lib/auth.ts` (`rateLimit`), `src/lib/rate-limit.ts`, `src/modules/data-import/parsing/file-sniff.ts` |
| Elevation of privilege | Không có đường tự nâng vai trò; đăng ký luôn `ADVISOR` + `PENDING_APPROVAL`; đổi vai trò chỉ ở module admin, có Audit Log; Admin không xử lý được cảnh báo | `src/modules/admin/services/account.service.ts`, `tests/integration/advisor-registration.test.ts` |

## Checklist bắt buộc

| Mục | Kết quả |
|---|---|
| Không `dangerouslySetInnerHTML` với dữ liệu người dùng | Đạt. Chỉ có 1 chỗ trong `components/ui/chart.tsx` (shadcn) chèn CSS màu từ cấu hình biểu đồ cố định trong code, không phải dữ liệu người dùng |
| Truy vấn có tham số, không nối chuỗi SQL | Đạt — QueryBuilder `:param`; `query()` dùng `$1`; tìm kiếm thoát ký tự `%`, `_` |
| Kiểm tra file tải lên (đuôi + nội dung thật + kích thước) | Đạt (Phase 3) |
| Chống chèn công thức ở file xuất | Đạt — file dòng lỗi thêm `'` trước `= + - @` |
| Session hết hạn | 8 giờ (`SESSION_EXPIRES_SECONDS`) |
| Đăng nhập sai ghi Audit Log | Đạt — `LOGIN_FAILED`, `SIGN_IN_REJECTED` |
| CSRF | Dùng bảo vệ mặc định của Server Actions (cùng nguồn) |
| Header bảo mật | Thêm Phase 7: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, tắt `X-Powered-By` (`next.config.ts`) |
| Bí mật không commit | `.env` trong `.gitignore`; `AUTH_SECRET` đã sinh lại ngẫu nhiên 48 byte (Phase 7) |
| Email cán bộ | `STAFF_EMAIL_DOMAIN=@ctuet.edu.vn` (đã bỏ chế độ thử `*`) |
| Container | Multi-stage, chạy user không phải root, image không có devDependencies |
| `npm audit --omit=dev --audit-level=high` | Đạt — 0 high/critical. Còn 6 mức trung bình, đều gián tiếp qua `exceljs` (uuid) và `minio` (query-string, decode-uri-component, stream-json); chưa có bản vá tương thích, không ảnh hưởng luồng nhận dữ liệu từ người dùng — theo dõi mỗi lần cập nhật |

## Giới hạn — yêu cầu khi triển khai thật

- **TLS**: môi trường demo chạy `localhost` không bật TLS. Khi triển khai: đặt reverse proxy HTTPS (VD Caddy/Nginx) trước `app`, bật HSTS; `DATABASE_URL` thêm `?sslmode=require`; SMTP qua TLS. Hướng dẫn trong `README.md`.
- **CSP** (Content-Security-Policy) chưa bật vì Next.js cần script nội tuyến; bật ở reverse proxy khi triển khai với nonce.
- **Ẩn danh hóa sinh viên** theo Luật 91/2025/QH15: đã thiết kế hướng làm, chưa cài đặt (hoãn theo quyết định người dùng) — hướng phát triển.
