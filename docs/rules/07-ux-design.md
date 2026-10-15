# 07 — Thiết kế UX

Xem `00-project-context.md` cho glossary và vai trò người dùng.

## Nguyên tắc chung — hỗ trợ quyết định, không phán xét

- MUST: mọi ngôn ngữ trong UI/thông báo/email trung tính, hướng giải pháp. MUST NOT dùng từ mang tính đổ lỗi ("sinh viên yếu kém", "vi phạm") — dùng ngôn ngữ mô tả sự việc + gợi ý hành động ("có dấu hiệu cần hỗ trợ", "gợi ý: liên hệ trong 48 giờ").
- MUST: mọi cảnh báo hiển thị cho CVHT trả lời được trong 5 giây đọc lướt: Ai (tên, mã số) — Vì sao (lý do chính, không phải toàn bộ log kỹ thuật) — Cần làm gì (nút hành động rõ ràng).

## Cảm giác chung

- MUST: giao diện sáng, gọn, nhiều khoảng trắng, nhất quán theo `03-ui-design.md` (trắng + xanh dương). Mỗi màn hình có 1 hành động chính rõ ràng bằng nút xanh dương.
- MUST: lời văn thân thiện, lịch sự, xưng hô nhất quán ("bạn" với sinh viên, trang trọng với Cố vấn học tập/Admin).
- SHOULD: phản hồi thao tác bằng Toast ngắn gọn (VD: "Đã ghi nhận can thiệp"), MUST NOT dùng popup chặn cho thông báo thành công.

## CVHT — người dùng chính, tần suất cao

- MUST: màn hình chính của CVHT mặc định mở ra danh sách `Alert` cần hành động (`OPEN`/`ACKNOWLEDGED`) — MUST NOT mở màn hình thống kê tổng quan làm mặc định.
- MUST: luồng "Xác nhận → Ghi can thiệp" tối đa 2 lần click từ danh sách — dùng Sheet/Dialog hiển thị chi tiết + form can thiệp trên cùng màn hình, MUST NOT chuyển sang trang riêng.
- MUST: khi 1 `Alert` có nhiều `RuleTrigger`, hiển thị tóm tắt trước (ví dụ "3 nguyên nhân: vắng học, giảm tương tác LMS, điểm giữa kỳ thấp"), cho mở rộng xem chi tiết — MUST NOT bắt đọc hết log ngay từ đầu.
- SHOULD: có chế độ "Đánh dấu đã xem tất cả" cho `Alert` mức `LOW` để giảm cảm giác quá tải.

## Sinh viên — cần trấn an, không gây hoảng loạn

- MUST: chỉ hiển thị cảnh báo đã được Cố vấn học tập xác nhận (xem `06`); mức hiển thị "Cần chú ý" khi có cảnh báo đã xác nhận mức ≥ `MEDIUM` chưa xử lý xong, ngược lại "Ổn định". Kèm số liệu từng học phần (tỷ lệ vắng, bài kiểm tra chưa làm, điểm quá trình) và gợi ý hành động.

- MUST NOT: dùng từ "cảnh báo"/"rủi ro" làm tiêu đề chính trên trang cá nhân sinh viên — dùng khung tích cực ("Tình hình học tập của bạn") kèm gợi ý cụ thể, dễ hành động.
- MUST NOT: hiển thị con số `RiskScoreLog.riskScoreValue` thô (0.0–1.0) cho role `STUDENT` — chỉ hiển thị mức đã diễn giải (VD: "Cần chú ý" / "Ổn định").
- MUST: có nút/link liên hệ CVHT trực tiếp ngay trên trang cảnh báo cá nhân.

## Admin — cấu hình an toàn

- MUST: màn hình cấu hình luật có chế độ xem trước tác động trước khi kích hoạt (ước tính số sinh viên bị ảnh hưởng nếu áp dụng ngưỡng mới).
- MUST: thao tác nguy hiểm (kích hoạt luật mới, hủy batch, đổi trọng số lớn) có bước xác nhận thứ hai (AlertDialog) — MUST NOT thực hiện ngay sau 1 lần click.
- MUST: có nút "Chạy đánh giá ngay" (chọn học kỳ, tùy chọn học phần) hiển thị tiến độ thật từ `EvaluationRun` (VD: "Đã xử lý 340/1200 sinh viên") và bản tóm tắt khi xong (số cảnh báo mới, số cập nhật, số sinh viên thiếu dữ liệu). Khi đã có lần chạy đang diễn ra, nút bị vô hiệu kèm lời giải thích.
- MUST: sau khi kích hoạt luật mới, hiển thị lời gợi ý "Chạy đánh giá trên dữ liệu hiện có" ngay trên màn hình xác nhận.
- SHOULD: trang tổng quan Admin hiển thị thống kê chất lượng nhập liệu (tỷ lệ dòng lỗi theo batch, số sinh viên `INSUFFICIENT`) ở vị trí dễ thấy.

## Trạng thái rỗng, lỗi, đang tải

- MUST: mọi danh sách có thể rỗng có empty state có ý nghĩa (không chỉ "Không có dữ liệu") — ví dụ danh sách `Alert` rỗng: "Chưa có sinh viên nào cần chú ý trong học kỳ này".
- MUST: lỗi nhập file hiển thị có thể hành động — chỉ rõ dòng, cột, lý do, và nút "Tải file lỗi để sửa" ngay tại chỗ báo lỗi, MUST NOT chỉ báo "Lỗi" chung chung.
- SHOULD: loading state cho thao tác chạy lâu (nhập file lớn, tính RiskScore) hiển thị tiến độ có ý nghĩa (VD: "Đang xử lý 340/1200 sinh viên") thay vì spinner vô nghĩa, nếu API hỗ trợ trả tiến độ.

## Khả năng tiếp cận

- MUST NOT: dùng màu làm phương tiện truyền tải thông tin duy nhất — Severity luôn có label chữ đi kèm màu.
- MUST: giữ nguyên thuộc tính ARIA mặc định của Radix UI (nền tảng shadcn/ui) — MUST NOT ghi đè làm mất ARIA.
- MUST: kích thước vùng chạm tối thiểu 44×44px trên giao diện mobile cho nút hành động quan trọng (Xác nhận, Gọi điện).

## Lời văn hiển thị cho người dùng

- MUST NOT: hiển thị cho người dùng cuối số hiệu file rules (`00`, `10`, `12`), tên entity/bảng (`ImportErrorRow`, `Enrollment`), mã lỗi kỹ thuật (`STUDENT_NOT_FOUND`) hay tên thuật toán (SHA-256). Dùng câu nghiệp vụ, VD: "Chỉ nhận dữ liệu của sinh viên đã có trong danh sách. Hệ thống tự phát hiện file đã nhập trước đó. Dòng lỗi được tách riêng để bạn tải về sửa." Mã lỗi kỹ thuật chỉ nằm trong file lỗi tải về, kèm cột diễn giải tiếng Việt.
- MUST: header Admin hiển thị học kỳ hiện tại; mọi danh sách theo học kỳ mặc định lọc học kỳ hiện tại, cho đổi sang học kỳ khác.
- MUST: trang "Bắt đầu" của Admin là checklist theo đúng thứ tự "Quy trình vận hành" trong `00-project-context.md`, tự đánh dấu bước đã có dữ liệu và chặn/gợi ý bước kế tiếp (VD: chưa có sinh viên thì nút nhập điểm danh hiển thị lý do).
- MUST: tài khoản `PENDING_APPROVAL` đăng nhập thấy trang "Đang chờ duyệt" thay vì lỗi; sinh viên chưa có hồ sơ thấy trang "Chưa có hồ sơ, liên hệ phòng Đào tạo".

## Hiển thị bằng chứng theo nguồn

- MUST: chi tiết cảnh báo cho CVHT nhóm lý do theo 3 nguồn (Điểm danh / Bài kiểm tra LMS / Kết quả học tập), mỗi lý do kèm số liệu cụ thể và ngày dữ liệu (VD: "Vắng không phép 4/20 buổi (20%), số liệu chốt ngày 05/10"; "Chưa làm 2 bài kiểm tra mà phần lớn lớp đã làm: Quiz 3, Quiz 4").
- MUST: với `COMB-02`, ghi rõ "Đang học lại học phần đã không đạt ở học kỳ …".

## Nhất quán thuật ngữ

- MUST: dùng đúng 1 tên gọi xuyên suốt app/email/tài liệu cho mỗi vai trò/khái niệm (tên hệ thống trên giao diện, email và báo cáo MUST giống nhau; "Cố vấn học tập" — không đổi thành "CVHT"/"Giảng viên chủ nhiệm"/"Advisor" tùy màn hình; "Cảnh báo sớm" — không đổi tên khác ở nơi khác).
- MUST: bộ lọc Khoa (suy ra qua lớp sinh hoạt) ở Tổng quan Admin, danh sách cảnh báo Admin và ô chọn học phần khi chạy đánh giá — người dùng chốt 2026-10-15.
- MUST: trang Nhật ký kiểm toán (Admin, chỉ đọc, phân trang) lọc theo khoảng thời gian, loại hành động, người thực hiện (mã/email), đối tượng (MSSV, mã lô…) — người dùng chốt 2026-10-13.
