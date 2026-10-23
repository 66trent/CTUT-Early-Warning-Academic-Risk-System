# Kịch bản demo bảo vệ đồ án

1 kịch bản chính (~10 phút) trên bộ dữ liệu demo v2 (`docs/demo-data/`, 1 lớp `KTPM2411`, 3 học phần, học kỳ 1 2025–2026) + 2 kịch bản thao tác thêm để trả lời câu hỏi của hội đồng. Mọi con số dưới đây khớp `docs/demo-data/KET_QUA_MONG_DOI.md` và được kiểm tự động (`tests/integration/rule-engine-acceptance.test.ts`, `alerts.test.ts`). Kịch bản nhỏ có dữ liệu riêng (bộ cũ ở `docs/demo-data/_luu-tru-v1/`) đang được viết lại theo 12 luật mới ở Phase 9.

## Chuẩn bị (trước giờ bảo vệ ~15 phút)

```bash
docker compose --profile dev up -d
```

```bash
npm run demo:reset -- --yes
```

- `demo:reset` xóa dữ liệu, tự sao lưu trước, dựng lại bộ demo v3: 5 lớp khóa 2024 Khoa CNTT (mỗi lớp 20 sinh viên, 1 chủ đề tình huống, 1 Cố vấn học tập GV001–GV005 — bảng ở `docs/demo-data/KET_QUA_MONG_DOI.md`), nạp 7 lô nhiều file (1 file / lớp học phần như trường xuất). Chế độ demo **không tự chạy đánh giá** sau khi nạp và **không chạy lịch đêm** — cảnh báo chỉ xuất hiện khi bấm "Chạy đánh giá" lúc trình bày.
- Mở sẵn 3 tab: http://localhost:3000 (Admin), cửa sổ ẩn danh (Cố vấn học tập), http://localhost:8025 (MailHog — email cảnh báo gửi Cố vấn học tập).
- Kiểm tra nhanh (tùy chọn, ~30 giây): `npm run demo:reset -- --yes --evaluate=2` → `npm run test:e2e` (2 luồng) → `npm run demo:reset -- --yes` để trả lại trạng thái ban đầu.

## Kịch bản chính (10 phút)

| Phút | Màn hình | Thao tác | Nói gì |
|---|---|---|---|
| 0:00 | `/login` | Giới thiệu 2 tab Sinh viên (Google) / Cán bộ; link "Chính sách bảo vệ dữ liệu cá nhân" | 3 vai trò; sinh viên chỉ đăng nhập Google email trường và phải có hồ sơ; Cố vấn học tập tự đăng ký → Admin duyệt; tuân thủ Luật 91/2025/QH15 |
| 0:45 | Admin → **Bắt đầu** | Đăng nhập nhanh "Quản trị viên" | Hướng dẫn theo đúng quy trình vận hành (thiết lập → mỗi học kỳ → hằng tuần → cuối kỳ), số liệu thật, bước thiếu dữ liệu bị khóa |
| 1:30 | **Nhập dữ liệu** | Mở lô **Điểm danh** (32 file): bảng từng file, thẻ nhận diện 16 lớp học phần (mã học phần tự suy), cảnh báo "có thể sai MSSV" ghi tên file (Tuấn ≠ Tú). Quay lại, xem bảng **Học phần nào cần nạp dữ liệu** | Nhập 2 bước (xem trước → xác nhận), file gốc lưu MinIO, hoàn tác có điều kiện; bảng độ mới cho biết học phần nào chậm / chưa có dữ liệu |
| 2:15 | **Nhập dữ liệu** | Loại "Điểm danh" → kéo thả file trong `docs/demo-data/minh-hoa-loi/` → xem 2 **dòng lỗi** (MSSV không có, ngày kiểu Mỹ `10/2/2025`) → **Hủy lô** | Nạp nhiều file 1 lần thành 1 lô (tối đa 50 file); dòng lỗi ghi tên file + số dòng, tải file lỗi để sửa; ngày không rõ thì từ chối, KHÔNG đoán |
| 3:00 | **Chạy đánh giá** | Học kỳ 1 2025–2026, mốc **2025-10-10** → Chạy, xem thanh tiến độ → mở kết quả | Mốc dữ liệu = chỉ dùng dữ liệu đến ngày đó (kết quả học phần công bố 16/11 chưa được dùng — không rò rỉ tương lai). **24 cảnh báo** từ 41 dấu hiệu của 5 lớp; bảng theo sinh viên: mức cao nhất, điểm rủi ro 0–1, mức đủ dữ liệu |
| 4:00 | **Tổng quan** | Dải "Cần chú ý", 4 thẻ số, tiến độ xử lý, dấu hiệu theo nguồn, độ mới dữ liệu; bấm "cảnh báo rất cao" → danh sách đã lọc | Admin chỉ giám sát; sinh viên "chưa đủ dữ liệu" không bị coi là rủi ro thấp |
| 4:45 | **Cảnh báo sớm** (Admin) | Danh sách chỉ đọc → **Xuất Excel** | 1 cảnh báo / sinh viên / học kỳ, mức = cao nhất; Admin không xử lý được; xuất file có nhật ký, chống chèn công thức |
| 5:15 | Tab ẩn danh → GV001 | Đăng nhập nhanh "Cố vấn học tập GV001" → **Tổng quan** → **Cảnh báo cần xử lý** → **Ma trận lớp** | Tổng quan lớp mình; chuông thông báo + email MailHog (mức thấp chỉ báo trong ứng dụng); ma trận sinh viên × học phần, bấm ô mở cảnh báo |
| 6:15 | Mở **KTPM2411903** (Lê Văn Cường) | Xem bằng chứng: Hệ quản trị CSDL vắng 13/60 tiết = 21,7% (`ATT-01` Rất cao) + vắng không phép tăng 3 → 11 trong 7 ngày (`ATT-02`) → **Xác nhận đã xem** → ghi can thiệp → Lưu | Cảnh báo là tham khảo, không đổi tình trạng học vụ; can thiệp "nhạy cảm" ẩn với Admin |
| 7:15 | Đăng nhập nhanh **Sinh viên KTPM2411903** | Trang "Tình hình học tập" | Sinh viên chỉ thấy cảnh báo SAU khi Cố vấn học tập xác nhận, kèm gợi ý; thanh vắng vượt vạch ngưỡng; không nhận email |
| 7:45 | Đăng nhập nhanh **GV002** | Chỉ thấy 5 cảnh báo lớp CNTT2411 (chủ đề LMS) | Phân quyền theo lớp sinh hoạt — GV002 không xem được sinh viên KTPM của GV001 |
| 8:15 | Admin → **Chạy đánh giá** mốc **2025-11-20** | Chạy → 29 cảnh báo | Logic học đã khóa điểm → `ACA-01` (điểm F) cho KTPM 913, 914, 919; điểm danh 2 môn kia quá hạn → giữ dấu hiệu cũ, không coi là "hết vắng"; 913 giảm mức Rất cao → Cao **không** gửi thông báo |
| 9:00 | **Cấu hình luật** → ATT-01 | Thêm mức 8% "Thấp" → Lưu bản nháp → Chạy thử mốc 2025-10-10 → thấy sinh viên thêm vào → Bỏ bản nháp | Luật cấu hình được, có phiên bản, bắt buộc chạy thử trước khi kích hoạt, ghi nhật ký |
| 9:40 | **Nhật ký hệ thống** | Lọc "Xem hồ sơ sinh viên" / "Tải file nhập dữ liệu" | Mọi thao tác quan trọng ghi lại, không sửa/xóa được |

## Hội đồng hỏi gì → mở gì

| Câu hỏi | Mở |
|---|---|
| File nhập sai thì sao? Excel được không? Nạp nhầm? Nhiều file? | Nạp 1 file có MSSV không tồn tại → "Dòng lỗi" + tải file lỗi → sửa → "Nạp lại file đã sửa"; hoàn tác lô (luồng Playwright `tests/e2e/import-errors.spec.ts` làm đúng các bước này) |
| Ngưỡng vắng 10/15/20% chạy đúng chưa? Đúng 20% ra mức gì? | KTPM2411904: Hệ quản trị CSDL vắng đúng 12/60 = 20% → Cao (chưa vượt); 903 vắng 21,7% → Rất cao |
| Vắng tăng nhanh? | KTPM2411903, 913, KHMT2411904 (`ATT-02`); KTPM2411904 tăng 5 tiết < 6 tiết (10% × 60) → không cảnh báo |
| Bài LMS: không làm, điểm thấp, không nộp, nộp trễ? | Lớp CNTT2411 (GV002): 903, 905, 906 (đúng 50% → không), 907, 908, 909 (bài chưa tới hạn → chưa cảnh báo ở mốc 10/10) |
| Nhiều nguồn cùng xấu? | Lớp KHMT2411 (GV004): 903 (3 nguồn), 904; KTPM2411910 — `COMB-01` Rất cao |
| Rớt môn, ĐTB hệ 4, A = 3,8? Chốt học kỳ? | Lớp HTTT2411 (GV003): học lại 903, 904 (`COMB-02`), sa sút 906, 907 (`ACA-04`), 908 (2 học kỳ chạm quy chế); Kịch bản 10 bước 5 (chốt → 35 cảnh báo; KTPM2411918 ĐTB 1,93 vì A = 3,8) |
| Thiếu dữ liệu có bị coi là rủi ro thấp? | Lớp KHDL2411 (GV005): kết quả đánh giá mốc 10/10 — 918 "Một phần", 919 "Chưa đủ" (không có điểm rủi ro); 903 bỏ học phần |
| Đổi Cố vấn học tập của lớp thì cảnh báo đi đâu? | Kịch bản 09 bên dưới |
| Đổi trọng số / ngưỡng ảnh hưởng thế nào? Chạy riêng 1 học phần? | Kịch bản 10 bên dưới |
| Hiệu năng 5.000 sinh viên? Sao lưu? Bảo mật? | `docs/bao-cao/02-hieu-nang.md`, `03-sao-luu-khoi-phuc.md`, `01-ra-soat-bao-mat.md` |
| Trọng số điểm rủi ro lấy ở đâu? | `docs/rules/08-business-rules-catalog.md` mục RiskScore (lý do + chưa hiệu chỉnh bằng dữ liệu thật) |

## Kịch bản 09 — Phân quyền và đổi Cố vấn học tập

1. GV001 thấy sinh viên `KTPM2411*`; GV002 chỉ thấy `CNTT2411*`. Thử mở thẳng đường dẫn hồ sơ `/advisor/students/KTPM2411903` bằng tài khoản GV002 → bị chặn.
2. Admin → **Khoa và lớp sinh hoạt** → `KTPM2411` → **Đổi Cố vấn** sang GV002 → các cảnh báo đang mở chuyển sang GV002 (ghi nhật ký "Chuyển cảnh báo sang Cố vấn học tập khác"); GV001 mất quyền ngay.
3. Đổi lại GV001 để trả về như cũ.

## Kịch bản 10 — Quản trị và vận hành

1. **Kích hoạt luật**: Cấu hình luật → ATT-01 → thêm mức 8% "Thấp" → Lưu nháp → Chạy thử (mốc 2025-10-10) → Kích hoạt → bấm "Chạy đánh giá ngay" được gợi ý. Trả lại: tạo bản mới đúng ngưỡng cũ.
2. **Trọng số điểm rủi ro**: Cấu hình luật → RISK-SCORE → đổi trọng số → Chạy thử: số sinh viên có dấu hiệu không đổi, chỉ điểm rủi ro đổi (điểm rủi ro chỉ để sắp xếp, không tạo cảnh báo).
3. **Chạy theo 1 học phần**: Chạy đánh giá → chọn học phần Hệ quản trị cơ sở dữ liệu → chạy: chỉ xét sinh viên học phần đó, **không hạ mức** cảnh báo của học phần khác.
4. **Rút học phần**: Hồ sơ sinh viên → đánh dấu rút học phần → lần chạy sau không xét học phần đó (không tự chạy đánh giá).
5. **Chốt học kỳ** (chỉ làm cuối buổi — không mở lại được; muốn quay lại thì `demo:reset`): Học kỳ → **Chốt học kỳ 1 2025–2026** → hộp thoại liệt kê **2 sinh viên thiếu kết quả** (KTPM2411919 · PTTK HTTT, KHDL2411903 · Phân tích CSDL lớn) → xác nhận → lần chạy cuối (`ACA-02/03/04`) → **35 cảnh báo**; sau đó không nạp thêm, không chạy đánh giá học kỳ đó nữa.
6. **Sao lưu**: `npm run backup` → `npm run restore -- backups/<file>.dump` (khôi phục vào DB thử, so số dòng).

## Sau buổi bảo vệ

```bash
npm run demo:reset -- --yes
```
