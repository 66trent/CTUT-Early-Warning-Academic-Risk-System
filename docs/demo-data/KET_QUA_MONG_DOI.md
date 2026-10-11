# Bộ dữ liệu demo — thứ tự nạp và kết quả mong đợi

Bộ dữ liệu này vừa là **kịch bản demo** khi bảo vệ, vừa là **test nghiệm thu** (xem `docs/rules/02-code-quality.md`). Mọi con số dưới đây đã được tính lại bằng một bộ tính độc lập theo đúng `08-business-rules-catalog.md` với ngưỡng mặc định: vắng tính cả có phép và không phép trên tổng số buổi theo kế hoạch (`tong_buoi_ke_hoach`), cấm thi khi vượt quá 20%; thang hệ 4 A=4, B=3, C=2, D=1, F=0. Khi đổi luật hoặc ngưỡng mặc định: sửa file này trước, rồi mới sửa code.

## Dữ liệu nền (tạo bằng `npm run seed:demo`, chỉ khi `DEMO_MODE=true`)

| Loại | Giá trị |
|---|---|
| CVHT | `GV001` (`gv001@ctuet.edu.vn`), `GV002` (`gv002@ctuet.edu.vn`) — `ACTIVE`, mật khẩu đọc từ biến môi trường |
| Lớp sinh hoạt | `KTPM2311` (Kỹ thuật phần mềm K2023, khoa `K.CNTT`, CVHT `GV001`) · `KHMT2311` (Khoa học máy tính K2023, khoa `K.CNTT`, CVHT `GV002`) |
| Học kỳ | `HK2_2025` (Học kỳ 2, 2025–2026, 2026-01-05 → 2026-05-31) · `HK1_2026` (Học kỳ 1, 2026–2027, 2026-08-17 → 2026-12-27, **hiện tại**) |

## Thứ tự nạp và chạy

| Bước | Việc | Học kỳ chọn trên form |
|---|---|---|
| 1 | Nạp `01_sinh_vien.csv` | — |
| 2 | Nạp `02_HK2_2025_ket_qua_hoc_phan.csv` | `HK2_2025` |
| 3 | Chạy đánh giá `HK2_2025`, **asOf = 2026-06-15** | — |
| 4 | Nạp `03_HK1_2026_diem_danh_tong_hop.csv` | `HK1_2026` |
| 5 | Nạp `04_HK1_2026_lms_bai_kiem_tra.csv` | `HK1_2026` |
| 6 | Nạp `05_HK1_2026_ket_qua_giua_ky.csv` | `HK1_2026` |
| 7 | Chạy đánh giá `HK1_2026`, **asOf = 2026-10-10** | — |

Lần chạy tự động sau mỗi lần nạp dùng `asOf` = thời điểm thật nên có thể ra ít cảnh báo hơn (VD: số liệu điểm danh quá 14 ngày → `STALE`). Nghiệm thu chỉ dựa vào bước 3 và 7.

## Cảnh báo mong đợi — PHẢI có đúng và đủ danh sách này

### Học kỳ `HK2_2025` (asOf 2026-06-15)

| Sinh viên | Luật | Mức | Vì sao |
|---|---|---|---|
| KTPM2311009 | `ACA-02` | CRITICAL | Rớt 2 học phần (KTPM101, KTPM103) |
| KTPM2311009 | `ACA-03` | HIGH | GPA4 = (0 + 1 + 0) × 3 / 9 = 0,33 |
| KTPM2311010 | `ACA-02` | HIGH | Rớt 1 học phần (KTPM101) |
| KTPM2311011 | `ACA-03` | HIGH | Đạt hết (D, D, C) nhưng GPA4 = (1 + 1 + 2) × 3 / 9 = 1,33 |

### Học kỳ `HK1_2026` (asOf 2026-10-10)

| Sinh viên | Học phần | Luật | Mức | Vì sao |
|---|---|---|---|---|
| KTPM2311002 | KTPM201 | `ATT-01` | MEDIUM | Vắng 3/30 buổi kế hoạch (1 có phép + 2 không phép) = đúng 10% |
| KTPM2311003 | KTPM201 | `ATT-01` | CRITICAL | Vắng 7/30 = 23,3% > 20% — đã vượt ngưỡng cấm thi |
| KTPM2311003 | KTPM201 | `ATT-02` | HIGH | Vắng không phép 1 (02/10) → 6 (09/10), tăng 5 trong 7 ngày |
| KTPM2311004 | KTPM201 | `ATT-03` | LOW | Đi trễ 3 buổi |
| KTPM2311005 | KTPM201 | `LMS-01` | HIGH | Bỏ 3 bài đến hạn Q01, Q02, Q03 (Q03 chỉ có lượt đang làm, không nộp) |
| KTPM2311006 | KTPM201 | `LMS-02` | MEDIUM | 2 bài gần nhất: Q03 = 4/10, Q02 = 3/10 (lấy lượt cao nhất trong 2 lần) |
| KTPM2311007 | KTPM201 | `ACA-01` | HIGH | Điểm quá trình 4,0 |
| KTPM2311008 | KTPM201 | `ATT-01` | MEDIUM | Vắng 3/30 = 10% |
| KTPM2311008 | KTPM201 | `LMS-01` | MEDIUM | Bỏ Q02 |
| KTPM2311008 | KTPM201 | `COMB-01` | CRITICAL | Nhóm điểm danh + nhóm LMS cùng ≥ MEDIUM |
| KTPM2311009 | KTPM103 | `LMS-01` | MEDIUM | Bỏ QA (2/3 lớp đã làm) |
| KTPM2311009 | KTPM103 | `COMB-02` | HIGH | Đang học lại KTPM103 (rớt ở `HK2_2025`, `attemptNumber = 2`) + LMS-01 MEDIUM → nâng 1 bậc |
| KHMT2311012 | KTPM201 | `ATT-01` | HIGH | Vắng 6/30 = đúng 20%, chưa vượt nên là HIGH, không phải CRITICAL — chỉ CVHT `GV002` thấy |

## PHẢI KHÔNG có cảnh báo — ca sát ngưỡng và ngoại lệ

| Sinh viên | Học phần | Vì sao không |
|---|---|---|
| KTPM2311001 | mọi học phần | Đối chứng, không có tín hiệu |
| KTPM2311010 | `HK2_2025` | `ACA-03`: GPA4 = (0 + 3 + 3) × 3 / 9 = đúng 2,0 (luật là `< 2.0`) |
| KTPM2311007, KTPM2311013 | KTPM201 | Vắng 1/30 = 3,3%, dưới 10% |
| KTPM2311003 | KTPM201 | `LMS-02`: Q03 = 5/10 đúng bằng 50% (luật là `< 0.5`) |
| KTPM2311006 | KTPM201 | `ACA-01`: điểm quá trình 5,0 (luật là `< 5.0`) |
| KTPM2311013 | KTPM202 | Vắng 2/15 = 13,3% nhưng mới học 3 buổi `< minSessions` (4); học phần không có bài kiểm tra → LMS `NOT_APPLICABLE` |
| mọi sinh viên | KTPM201 | Q04 (lượt làm đầu 08/10) chưa đến hạn: chưa đủ 3 ngày và chỉ 2/10 sinh viên làm |
| KTPM2311010, KTPM2311011 | `HK1_2026` | Không có dữ liệu học kỳ này |

## Kiểm tra phân quyền bằng tay

- Đăng nhập `GV001`: thấy cảnh báo của các sinh viên `KTPM2311*`, KHÔNG thấy `KHMT2311012`.
- Đăng nhập `GV002`: chỉ thấy `KHMT2311012`.
- Admin đổi CVHT lớp `KTPM2311` sang `GV002` → mọi cảnh báo đang mở của lớp chuyển sang `GV002`; `GV001` mất quyền xem ngay.
- Sinh viên chưa có trong `01_sinh_vien.csv` đăng nhập Google → trang "Chưa có hồ sơ".
