# Kịch bản demo bảo vệ đồ án

1 kịch bản chính (~10 phút) + 8 kịch bản nhỏ có dữ liệu riêng (`docs/demo-data/kich-ban/`) + 2 kịch bản thao tác trên dữ liệu chính, dùng để trả lời câu hỏi của hội đồng. Mọi kết quả mong đợi đều được kiểm tự động (`tests/integration/rule-engine-acceptance.test.ts`, `alerts.test.ts`, `demo-scenarios.test.ts`).

## Chuẩn bị (trước giờ bảo vệ ~15 phút)

```bash
docker compose --profile dev up -d
```

```bash
npm run demo:reset -- --yes
```

- `demo:reset` xóa dữ liệu, dựng lại bộ demo chuẩn (tự sao lưu trước). Chế độ demo **không tự chạy đánh giá** sau khi nạp và **không chạy lịch đêm** — cảnh báo chỉ xuất hiện khi bấm "Chạy đánh giá" trong lúc trình bày.
- Mở sẵn 3 tab: http://localhost:3000 (Admin), cửa sổ ẩn danh (Cố vấn học tập), http://localhost:8025 (MailHog).
- Kiểm tra nhanh: `npm run test:e2e` (2 luồng, ~20 giây) — chạy xong thì `demo:reset` lại vì test đổi trạng thái 1 cảnh báo.

## Kịch bản chính (10 phút)

| Phút | Màn hình | Thao tác | Nói gì |
|---|---|---|---|
| 0:00 | `/login` | Giới thiệu 2 tab Sinh viên (Google) / Cán bộ; link "Chính sách bảo vệ dữ liệu cá nhân" | 3 vai trò; sinh viên chỉ đăng nhập Google email trường; Cố vấn học tập tự đăng ký → Admin duyệt; tuân thủ Luật 91/2025/QH15 |
| 0:45 | Admin → **Bắt đầu** | Đăng nhập nhanh "Quản trị viên" | Checklist theo đúng quy trình vận hành: khoa → Cố vấn học tập → lớp → sinh viên → học kỳ → dữ liệu → đánh giá; bước thiếu dữ liệu bị khóa |
| 1:30 | **Nhập dữ liệu** | Mở lô `03_HK1_2026_diem_danh_tong_hop.csv` | Nhập 2 bước (xem trước → xác nhận), file gốc lưu MinIO, hoàn tác có điều kiện. (Nếu hỏi lỗi nhập → Kịch bản 01) |
| 2:30 | **Chạy đánh giá** | Học kỳ 2 2025–2026, mốc **2026-06-15** → Chạy | Mốc dữ liệu = chỉ dùng dữ liệu đến ngày đó (không rò rỉ tương lai). Kết quả: **4 dấu hiệu** (ACA-02, ACA-03) |
| 3:30 | **Chạy đánh giá** | Học kỳ 1 2026–2027 (hiện tại), mốc **2026-10-10** → Chạy, xem thanh tiến độ | **13 dấu hiệu**: 2 Rất cao · 5 Cao · 5 Trung bình · 1 Thấp; bảng điểm rủi ro + mức đủ dữ liệu |
| 4:30 | **Tổng quan** | Biểu đồ cảnh báo theo mức, sĩ số theo lớp; đổi bộ lọc Khoa | Admin chỉ giám sát; chất lượng nhập liệu; sinh viên "chưa đủ dữ liệu" không bị coi là rủi ro thấp |
| 5:15 | **Cảnh báo sớm** (Admin) | Danh sách chỉ đọc | 1 cảnh báo / sinh viên / học kỳ, mức = cao nhất; Admin không xử lý được |
| 5:45 | Tab ẩn danh → GV001 | Đăng nhập nhanh "Cố vấn học tập GV001" → **Cảnh báo cần xử lý** | GV001 thấy 3 cảnh báo HK2 + 8 cảnh báo HK1 lớp KTPM2311; chuông thông báo; email trong MailHog |
| 6:30 | Mở **KTPM2311003** | Xem 3 nguồn, mở bằng chứng (vắng 7/30 = 23,3%, tăng 5 buổi trong 7 ngày) → **Xác nhận đã xem** → ghi can thiệp → Lưu | Cảnh báo là tham khảo, không đổi tình trạng học vụ; can thiệp "nhạy cảm" ẩn với Admin |
| 7:45 | Đăng nhập nhanh **Sinh viên KTPM2311003** | Trang "Tình hình học tập" | Sinh viên chỉ thấy cảnh báo SAU khi Cố vấn học tập xác nhận, kèm gợi ý; không nhận email |
| 8:30 | Đăng nhập nhanh **GV002** | Chỉ thấy KHMT2311012 (vắng đúng 20% → Cao) | Phân quyền theo lớp sinh hoạt — GV002 không xem được sinh viên GV001 |
| 9:00 | Admin → **Cấu hình luật** → ATT-03 | Sửa "Số lần đi trễ từ" = 1 → Lưu bản nháp → Chạy thử mốc 2026-10-10 → thấy **3 sinh viên thêm vào** → Bỏ bản nháp | Luật cấu hình được, có phiên bản, bắt buộc chạy thử trước khi kích hoạt, ghi nhật ký |
| 9:45 | **Nhật ký hệ thống** | Lọc "Xem hồ sơ sinh viên" | Mọi thao tác quan trọng ghi lại, không sửa/xóa được |

## Hội đồng hỏi gì → mở gì

| Câu hỏi | Mở |
|---|---|
| File nhập sai thì sao? Excel được không? Nạp nhầm? | Kịch bản 01 (`npm run demo:scenario -- 1 --evaluate`) |
| Ngưỡng vắng 10/15/20% chạy đúng chưa? Đúng 20% ra mức gì? | Kịch bản 02 |
| Vắng tăng nhanh? Đi trễ? Dữ liệu cũ / bị sửa? | Kịch bản 03 |
| Không biết hạn nộp bài LMS thì tính "bỏ bài" thế nào? | Kịch bản 04 |
| Điểm giữa kỳ, rớt môn, điểm trung bình hệ 4? | Kịch bản 05 |
| Nhiều nguồn cùng xấu? Học lại vẫn sa sút? | Kịch bản 06 |
| Thiếu dữ liệu có bị coi là rủi ro thấp? Sinh viên rút học phần? | Kịch bản 07 |
| Cảnh báo đã xử lý mà sinh viên tệ hơn? Có gửi email trùng? Hoàn tác dữ liệu? | Kịch bản 08 (2 đợt) |
| Đổi Cố vấn học tập của lớp thì cảnh báo đi đâu? | Kịch bản 09 bên dưới |
| Đổi trọng số / ngưỡng ảnh hưởng thế nào? Chạy riêng 1 học phần? Chốt học kỳ? | Kịch bản 10 bên dưới |
| Hiệu năng 5.000 sinh viên? Sao lưu? Bảo mật? | `docs/bao-cao/02-hieu-nang.md`, `03-sao-luu-khoi-phuc.md`, `01-ra-soat-bao-mat.md` |
| Trọng số điểm rủi ro 0,4 / 0,3 / 0,3 lấy ở đâu? | `docs/rules/08-business-rules-catalog.md` mục RiskScore (lý do + chưa hiệu chỉnh bằng dữ liệu thật) |

Kịch bản 01–08: mỗi thư mục có `README.md` (các bước, bảng kết quả mong đợi) — nạp chồng lên dữ liệu chính, không cần reset (mỗi kịch bản dùng dải MSSV và học phần riêng).

## Kịch bản 09 — Phân quyền và đổi Cố vấn học tập (dữ liệu chính)

1. GV001 thấy KTPM2311xxx; GV002 chỉ thấy KHMT2311012. Thử mở thẳng đường dẫn hồ sơ 1 sinh viên lớp KTPM2311 bằng tài khoản GV002 → bị chặn.
2. Admin → **Khoa và lớp sinh hoạt** → KTPM2311 → **Đổi Cố vấn** sang GV002 → các cảnh báo đang mở chuyển sang GV002 (ghi nhật ký "Chuyển cảnh báo sang Cố vấn học tập khác"); GV001 mất quyền ngay.
3. Đổi lại GV001 để trả về như cũ.

## Kịch bản 10 — Quản trị và vận hành (dữ liệu chính)

1. **Kích hoạt luật**: Cấu hình luật → ATT-01 → thêm mức 8% "Thấp" → Lưu nháp → Chạy thử (mốc 2026-10-10) → Kích hoạt → bấm "Chạy đánh giá ngay" được gợi ý. Trả lại: tạo bản mới đúng ngưỡng cũ.
2. **Trọng số điểm rủi ro**: Cấu hình luật → RISK-SCORE → đổi trọng số → Chạy thử: số sinh viên có dấu hiệu không đổi, chỉ điểm rủi ro trung bình đổi (điểm rủi ro chỉ để sắp xếp, không tạo cảnh báo).
3. **Chạy theo 1 học phần**: Chạy đánh giá → Học kỳ 1 → lọc khoa → KTPM202 → chạy: chỉ xét sinh viên học phần đó, **không hạ mức** cảnh báo của học phần khác.
4. **Rút học phần**: xem Kịch bản 07.
5. **Chốt học kỳ**: Học kỳ → Chốt học kỳ 2 2025–2026 → không nạp thêm điểm danh/LMS, không chạy đánh giá học kỳ đó nữa (chỉ làm cuối buổi — không mở lại được; muốn quay lại thì `demo:reset`).
6. **Sao lưu**: `npm run backup` → `npm run restore -- backups/<file>.dump` (khôi phục vào DB thử, so số dòng).

## Sau buổi bảo vệ

```bash
npm run demo:reset -- --yes
```
