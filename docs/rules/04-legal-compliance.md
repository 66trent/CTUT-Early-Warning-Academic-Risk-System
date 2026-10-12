# 04 — Tuân thủ Pháp lý (Bảo vệ Dữ liệu Cá nhân)

Căn cứ: Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (Quốc hội, hiệu lực 01/01/2026) và Nghị định 356/2025/NĐ-CP (Chính phủ, quy định chi tiết thi hành, hiệu lực 01/01/2026, thay thế Nghị định 13/2023/NĐ-CP).

## Trang "Chính sách bảo vệ dữ liệu cá nhân" — nội dung bắt buộc

Route `/legal/privacy-policy` MUST trình bày đủ 7 mục:

1. **Bên kiểm soát dữ liệu**: tên đơn vị đào tạo triển khai, thông tin liên hệ bộ phận phụ trách bảo vệ dữ liệu.
2. **Loại dữ liệu xử lý**, phân theo 2 nhóm:
   - Dữ liệu cơ bản: mã số sinh viên, họ tên, lớp/khoa, điểm danh, kết quả học tập, log LMS.
   - Dữ liệu nhạy cảm (nếu có): lý do vắng có phép liên quan sức khỏe — phải nêu rõ nếu hệ thống lưu, kèm biện pháp bảo vệ tăng cường.
3. **Mục đích xử lý**: phát hiện dấu hiệu rủi ro học tập, hỗ trợ cố vấn học tập can thiệp sớm. Nêu rõ KHÔNG dùng cho mục đích khác (không chia sẻ bên thứ ba ngoài phạm vi đào tạo, không dùng cho quảng cáo/thương mại).
4. **Căn cứ xử lý dữ liệu**: theo quy chế đào tạo đã công bố của trường.
5. **Thời gian lưu trữ**: nêu cụ thể theo quy định lưu trữ hồ sơ đào tạo của trường.
6. **Quyền của sinh viên**: quyền truy cập dữ liệu của mình, quyền yêu cầu chỉnh sửa dữ liệu sai (qua phòng đào tạo, không tự sửa trong app), quyền khiếu nại.
7. **Biện pháp bảo mật áp dụng**: mã hóa lưu trữ/truyền tải, phân quyền theo phạm vi, audit log append-only (xem `06-security.md`).

## Ràng buộc kỹ thuật bắt buộc

- MUST: mã hóa kết nối app–PostgreSQL bằng TLS; mọi kết nối ra ngoài (SMTP, webhook LMS/SIS) dùng TLS.
- MUST: khi `Intervention.content` có khả năng chứa thông tin sức khỏe, đặt `Intervention.confidentialityLevel = SENSITIVE` — nội dung chỉ hiển thị cho CVHT phụ trách trực tiếp; ADMIN và mọi trang tổng quan KHÔNG hiển thị `content` của can thiệp `SENSITIVE`.
- MUST: khi có yêu cầu xóa dữ liệu cá nhân, dùng cơ chế ẩn danh hóa (thay `studentId` bằng mã không thể truy ngược) thay vì xóa cứng — vì Audit Log là append-only, không thể xóa bản ghi log liên quan.
- MUST NOT: log toàn bộ payload chứa dữ liệu cá nhân ra console/file log không kiểm soát truy cập — dùng logger có redact field nhạy cảm (`email`, `Intervention.content`) trước khi ghi log vận hành thông thường (khác Audit Log nghiệp vụ).
- MUST NOT: gửi dữ liệu cá nhân sinh viên qua dịch vụ bên thứ ba chưa xác nhận cam kết bảo mật. Ưu tiên SMTP nội bộ của trường thay vì dịch vụ email công cộng.
- MUST: file gốc các lô nhập (MinIO) chứa dữ liệu cá nhân → chỉ Admin tải được, giữ tối thiểu 1 học kỳ và tối đa theo quy định lưu trữ hồ sơ đào tạo của trường, nêu rõ trong mục "Thời gian lưu trữ" của trang chính sách.
- MUST NOT: dùng dữ liệu sinh viên thật trong seed/demo data — dữ liệu môi trường dev/test phải giả lập hoàn toàn hoặc đã ẩn danh hóa.

## Việc cần xác nhận thủ công (ngoài phạm vi code)

- Xác nhận với bộ phận pháp chế của trường về căn cứ xử lý dữ liệu cụ thể trước khi triển khai thật.
- Thực hiện đánh giá tác động (DPIA) sơ bộ theo Chương III Nghị định 356/2025/NĐ-CP trước khi triển khai thật (không bắt buộc ở giai đoạn phát triển).
