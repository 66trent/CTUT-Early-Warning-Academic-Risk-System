# Báo cáo tiến độ đồ án — CTUT-EWARS

**Đề tài:** Hệ thống cảnh báo sớm rủi ro học tập dựa trên luật nghiệp vụ có khả năng giải thích
**Học phần:** Đồ án Kỹ thuật phần mềm 3 — Ngành Kỹ thuật phần mềm
**Giảng viên hướng dẫn:** ThS. Phạm Thị Thùy Linh
**Sinh viên thực hiện:** Trương Minh Thuấn (KTPM2311019) · Nguyễn Tuấn Vũ (KTPM2311061)

> Cách dùng: mỗi lần báo cáo, đánh dấu `[x]` cho mục đã xong (ghi ngày hoàn thành), cập nhật bảng tổng hợp và thêm một dòng vào **Nhật ký báo cáo** ở cuối file. Không xóa mục cũ.

## Tổng hợp

| Hạng mục | Đã xong / Tổng | Ghi chú |
|---|---|---|
| A. Khảo sát và phân tích | 8 / 8 | |
| B. Thiết kế | 8 / 8 | |
| C. Cài đặt (12 mục giai đoạn) | 12 / 12 | Giai đoạn 7–9c đang chờ gộp vào nhánh chính |
| D. Kiểm thử | 8 / 9 | Còn đánh giá trên dữ liệu thật |
| E. Tài liệu | 7 / 10 | Còn slide bảo vệ, lời cảm ơn, cập nhật báo cáo kỹ thuật |
| F. Hoàn tất và bảo vệ | 1 / 7 | |
| **Tổng** | **44 / 54** | |

## A. Khảo sát và phân tích

- [x] Khảo sát hiện trạng, xác định vấn đề và khoảng trống của đề tài — 02/09/2026
- [x] Tổng quan 11 nghiên cứu liên quan (hiệu suất, cấu hình, khoảng trống) — 02/09/2026
- [x] Bản phân tích hệ thống đầu tiên (`E:\ctuet\NCKH\20260902-PHÂN TÍCH HỆ THỐNG.docx`) — 02/09/2026
- [x] Chốt 3 nguồn dữ liệu, mẫu tệp nhập và bộ dữ liệu mẫu có kết quả mong đợi tính tay — trước 11/10/2026
- [x] Chốt định nghĩa rủi ro, kết cục và ranh giới cảnh báo sớm / cảnh báo học vụ chính thức — 17/10/2026
- [x] Căn cứ pháp lý: Luật 91/2025/QH15, Nghị định 356/2025/NĐ-CP — 13/10/2026
- [x] Yêu cầu chức năng, phi chức năng có mã và tiêu chí chấp nhận; mô hình use case — 17/10/2026
- [x] Đặc tả bộ 10 luật, điểm rủi ro, mức cảnh báo, xử lý thiếu dữ liệu — 12/10/2026

## B. Thiết kế

- [x] Kiến trúc tổng thể (sơ đồ ngữ cảnh, thành phần, phân hệ, triển khai) — 11/10/2026
- [x] Mô hình dữ liệu 22 bảng và từ điển dữ liệu — 12/10/2026
- [x] Quy trình nhập dữ liệu 2 bước, chống trùng, đối soát, hoàn tác — 12/10/2026
- [x] Trình tự đánh giá 10 bước, chống rò rỉ thông tin theo thời gian — 12/10/2026
- [x] Vòng đời luật, vòng đời cảnh báo, can thiệp, chính sách thông báo — 13/10/2026
- [x] Phân quyền theo phạm vi lớp, phân tích mối đe dọa (STRIDE), nhật ký kiểm toán — 13/10/2026
- [x] Thiết kế giao diện (trắng – xanh dương, 3 cỡ màn hình, chế độ tối) — 11/10/2026
- [x] Kế hoạch sao lưu – khôi phục, theo dõi chất lượng dữ liệu — 15/10/2026

## C. Cài đặt

- [x] Giai đoạn 0 — Hạ tầng (Docker, cơ sở dữ liệu, kiểm tra tự động) — 11/10/2026
- [x] Giai đoạn 1 — Đăng nhập, phân quyền — 12/10/2026
- [x] Giai đoạn 2 — Danh mục: học kỳ, khoa, lớp, tài khoản — 12/10/2026
- [x] Giai đoạn 3a — Khung nhập dữ liệu, danh sách sinh viên — 12/10/2026
- [x] Giai đoạn 3b — Nhập điểm danh, bài kiểm tra LMS, kết quả học phần — 12/10/2026
- [x] Giai đoạn 4 — Bộ luật, điểm rủi ro, lần đánh giá — 12/10/2026
- [x] Giai đoạn 5 — Cảnh báo, can thiệp, thông báo, giao diện Cố vấn học tập và sinh viên — 13/10/2026
- [x] Giai đoạn 6 — Quản trị, cấu hình luật, nhật ký, trang chính sách dữ liệu — 13/10/2026
- [x] Giai đoạn 7 — Hoàn thiện: lịch chạy hằng đêm, bộ lọc khoa, bảo mật, hiệu năng, sao lưu, kịch bản trình diễn — 15/10/2026 *(chờ gộp vào nhánh chính — mục F)*
- [x] Giai đoạn 8a–8f — Điều chỉnh theo dữ liệu thật của trường (12 luật, Quy chế 336, điểm danh theo tiết) và hoàn thiện giao diện (tổng quan, ma trận lớp, xuất Excel, nạp nhiều tệp) — 20/10/2026
- [x] Giai đoạn 9a–9b — Danh mục ngành, 5 lớp Khoa CNTT, bộ dữ liệu trình diễn bản 3 (100 sinh viên) — 23/10/2026
- [x] Giai đoạn 9c — Kịch bản trình diễn theo lớp, chụp lại ảnh, chạy thử trọn luồng chính trên giao diện — 24/10/2026

## D. Kiểm thử và đánh giá

- [x] 356 ca kiểm thử tự động (đơn vị + tích hợp) — 15/10/2026
- [x] Nghiệm thu bộ dữ liệu mẫu: khớp 17/17 dấu hiệu, 12/12 cảnh báo — 13/10/2026
- [x] 8 kịch bản kiểm thử bổ sung — 15/10/2026
- [x] 2 luồng kiểm thử trên trình duyệt (nhập tệp lỗi; Cố vấn học tập xử lý cảnh báo) — 15/10/2026
- [x] Đo hiệu năng 5.000 sinh viên (22,3 giây / học kỳ; danh sách < 110 mili giây) — 15/10/2026
- [x] Diễn tập sao lưu – khôi phục (khớp 100% số dòng) — 15/10/2026
- [x] Rà soát bảo mật, kiểm tra giao diện 3 cỡ màn hình (40 ảnh, 0 lỗi tràn) — 15/10/2026
- [x] Kiểm thử lại sau giai đoạn 9: 415 ca tự động, nghiệm thu bộ bản 3 khớp 100% (24 → 29 → 35 cảnh báo), độ phủ phần luật 92,3%, diễn tập khôi phục bộ bản 3 — 24/10/2026
- [ ] Đánh giá hiệu quả dự báo trên dữ liệu thật đã ẩn danh (Chương 9 báo cáo) — *chờ dữ liệu của trường*

## E. Tài liệu

- [x] Báo cáo tổng kết đồ án (`docs/bao-cao/Bao-cao-do-an-CTUT-EWARS.docx`, 79 trang) — 17/10/2026
- [x] Báo cáo yêu cầu và thiết kế kỹ thuật (`docs/bao-cao/CTUT-EWARS_Bao-cao-yeu-cau-va-thiet-ke-ky-thuat.docx`, 106 trang) — 17/10/2026
- [x] Báo cáo đo hiệu năng, bảo mật, sao lưu, kiểm thử (`docs/bao-cao/*.md`) — 15/10/2026
- [x] Hướng dẫn cài đặt (README) và kịch bản trình diễn (`docs/demo-script.md`) — 15/10/2026
- [x] Chuẩn bị câu trả lời câu hỏi hội đồng (luật, nguyên lý, nghiên cứu liên quan, kết hợp luật, hiệu suất) — 17/10/2026
- [x] Cập nhật báo cáo tổng kết theo 12 luật và bộ dữ liệu bản 3 (83 trang; sơ đồ, ảnh, số đo mới) — 24/10/2026
- [x] Kịch bản thuyết trình dạng lời nói (`docs/bao-cao/kich-ban-thuyet-trinh.md`) — 24/10/2026
- [ ] Cập nhật báo cáo yêu cầu và thiết kế kỹ thuật theo 12 luật (bản hiện tại theo trạng thái 17/10)
- [ ] Hoàn thiện lời cảm ơn và các chỗ “[cần nhà trường xác nhận]” trong báo cáo
- [ ] Slide bảo vệ

## F. Hoàn tất và bảo vệ

- [x] Gộp giai đoạn 0–6 vào nhánh chính (PR #1–#8) — 15/10/2026
- [ ] Gộp giai đoạn 7 vào nhánh chính (PR #9)
- [ ] Xin dữ liệu thật đã ẩn danh từ Phòng Đào tạo/khoa
- [ ] Xin thông tin cho trang chính sách dữ liệu (đơn vị, đầu mối, thời hạn lưu trữ)
- [ ] Nộp báo cáo cho giảng viên hướng dẫn duyệt
- [ ] Chạy thử trọn kịch bản trình diễn trước buổi bảo vệ (`npm run demo:reset -- --yes`)
- [ ] Bảo vệ trước hội đồng

## G. Hoãn / hướng phát triển (không tính vào tiến độ)

- [ ] Ẩn danh hóa sinh viên theo yêu cầu xóa dữ liệu (đã thiết kế)
- [ ] Xác thực hai lớp cho Quản trị viên
- [ ] Nhắc hạn xử lý cảnh báo theo mức độ
- [ ] Xuất báo cáo theo lớp/khoa
- [ ] Kết nối trực tiếp hệ thống quản lý đào tạo và LMS

## Nhật ký báo cáo

| Lần | Ngày | Đã làm từ lần trước | Việc tiếp theo | Ý kiến giảng viên |
|---|---|---|---|---|
| 1 | 17/10/2026 | Hoàn thành phân tích, thiết kế và 9 giai đoạn cài đặt; 356 ca kiểm thử tự động; đo hiệu năng, diễn tập khôi phục; báo cáo tổng kết 79 trang và báo cáo kỹ thuật 106 trang | Gộp PR #9; xin dữ liệu ẩn danh để đánh giá thực nghiệm; làm slide bảo vệ; hoàn thiện báo cáo theo góp ý | |
| 2 | 24/10/2026 | Đối soát dữ liệu thật của trường: 12 luật theo Quy chế 336; giao diện tổng quan, ma trận lớp, xuất Excel, nạp nhiều tệp; mở rộng toàn Khoa CNTT (5 lớp, 100 sinh viên); kịch bản trình diễn + lời nói; cập nhật báo cáo tổng kết (83 trang); 415 ca kiểm thử | Gộp PR #9–#18 và PR 9c; cập nhật báo cáo kỹ thuật; làm slide; tập thuyết trình theo kịch bản | |
