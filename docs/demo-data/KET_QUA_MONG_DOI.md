# Bộ dữ liệu demo v2 — thứ tự nạp và kết quả mong đợi

Bộ dữ liệu này vừa là **kịch bản demo** khi bảo vệ, vừa là **test nghiệm thu** (`docs/rules/02`). Phiên bản 2 (Phase 8a, chốt 2026-10-18): cột theo ảnh hệ thống của trường, 12 luật của `08` bản 2. Giai đoạn 1 = **1 khoa, 1 lớp, 3 môn, 1 học kỳ** — mở rộng (học kỳ trước, học lại, nhiều lớp/khoa, kịch bản nhỏ) ở Phase 9. Bộ cũ (bản 1): `_luu-tru-v1/` (định dạng cũ, không nạp được).

Mọi con số dưới đây tính tay theo `08` với ngưỡng mặc định. Họ tên, MSSV là GIẢ (dải `KTPM2411901`–`920`, tránh MSSV thật). Tên/mã/tín chỉ/số tiết của "Ngôn ngữ lập trình 1" và "Cơ sở dữ liệu" là giá trị demo. Sinh lại file: `gen_demo_v2.py` (ghi chú ở cuối).

## Dữ liệu nền (`npm run seed:demo`, chỉ khi `DEMO_MODE=true`)

| Loại | Giá trị |
|---|---|
| CVHT | `GV001`–`GV005` — `ACTIVE`, mật khẩu đọc từ biến môi trường, mỗi người 1 lớp (Phase 9a). Đến khi có bộ v3 (Phase 9b) chỉ lớp của `GV001` có sinh viên → `GV002`–`GV005` không thấy cảnh báo nào (kiểm tra phân quyền) |
| Lớp sinh hoạt | `KTPM2411` (Kỹ thuật phần mềm K2024, khoa `K.CNTT`, ngành `KTPM`, khóa `2024`, CVHT `GV001`) + 4 lớp chưa có sinh viên: `CNTT2411` (`GV002`), `HTTT2411` (`GV003`), `KHMT2411` (`GV004`), `KHDL2411` (`GV005`) |
| Học kỳ | `HK1_2025` (Học kỳ 1, 2025–2026, 2025-08-18 → 2025-12-28, **hiện tại** — học kỳ đã qua để mọi mốc demo đều ở quá khứ; chế độ demo không cho chọn mốc tương lai). Khóa 2024 → học kỳ đầu khóa là `HK1_2024` (không phải học kỳ này → ngưỡng ĐTB thường 1,0). Thêm `HK3_2024` (học kỳ liền trước, chưa có dữ liệu → `ACA-04` không xét) |

## Học phần (mã học phần để trống trong file → tự suy = mã lớp học phần bỏ 2 số cuối)

| Học phần | Mã lớp học phần | Mã học phần (tự suy) | Số tiết | Tín chỉ | LMS |
|---|---|---|---|---|---|
| Logic học | `010100240802` | `0101002408` | 30 | 2 | Trắc nghiệm TN01 (hạn 20/09), TN02 (hạn 04/10) |
| Ngôn ngữ lập trình 1 | `010100239401` | `0101002394` | 45 | 3 | Trắc nghiệm TN01 (27/09), TN02 (08/10); thực hành TH01 (25/09), TH02 (05/10), TH03 (14/10) |
| Cơ sở dữ liệu | `010100241001` | `0101002410` | 45 | 3 | Thực hành TH01 (30/09), TH02 (07/10) — không có trắc nghiệm |

## Thứ tự nạp và chạy (học kỳ chọn trên form: `HK1_2025`)

| Bước | Việc | Kết quả nạp mong đợi |
|---|---|---|
| 1 | Nạp `01_sinh_vien.csv` | 20 sinh viên, 0 lỗi |
| 2 | Nạp `02_HK1_2025_diem_danh.csv` (ngày chốt 02/10 và 09/10) | 120 dòng, 0 lỗi, **1 cảnh báo `NAME_MISMATCH`** (dòng KTPM2411920 · Cơ sở dữ liệu · 09/10 ghi "Tuấn", hệ thống "Tú"); 3 thẻ nhận diện, mỗi thẻ 20 sinh viên lớp KTPM2411, mã học phần "tự suy" |
| 3 | Nạp `03_HK1_2025_lms_trac_nghiem.csv` | 81 dòng, 0 lỗi; 4 bài; 79 lượt làm (2 dòng "Chưa làm" không tạo lượt) |
| 4 | Nạp `04_HK1_2025_lms_thuc_hanh.csv` | 100 dòng, 0 lỗi; 5 bài |
| 5 | **Chạy 1** — `MANUAL`, **asOf = 2025-10-10** | xem "Chạy 1" |
| 6 | Nạp `05_HK1_2025_ket_qua_logic_hoc.csv` (công bố 16/11) | 20 dòng, 0 lỗi |
| 7 | **Chạy 2** — `MANUAL`, **asOf = 2025-11-20** | xem "Chạy 2" |
| 8 | Nạp `06_HK1_2025_ket_qua_cuoi_ky.csv` (công bố 28/12; **KTPM2411919 thiếu Cơ sở dữ liệu**) | 39 dòng, 0 lỗi |
| 9 | **Chốt học kỳ** → hộp thoại liệt kê **1 sinh viên thiếu kết quả: KTPM2411919 (Cơ sở dữ liệu)** → xác nhận → **Chạy 3** `TERM_CLOSING`, **asOf = 2025-12-31** → `HK1_2025` có `closedAt` | xem "Chạy 3" |

Chế độ demo không tự chạy sau nạp. Nghiệm thu dựa vào 3 lần chạy trên.

## Chạy 1 (asOf 2025-10-10) — dấu hiệu mong đợi, PHẢI đúng và đủ

| Sinh viên | Học phần | Luật | Mức | Vì sao |
|---|---|---|---|---|
| 902 | Logic học | `ATT-01` | MEDIUM | Vắng 3/30 tiết (1 có phép + 2 không phép) = đúng 10% |
| 903 | NNLT 1 | `ATT-01` | CRITICAL | Vắng 10/45 = 22,2% > 20% — đã vượt ngưỡng cấm thi |
| 903 | NNLT 1 | `ATT-02` | HIGH | Vắng không phép 2 (02/10) → 8 (09/10): tăng 6 tiết ≥ 10% × 45 = 4,5 |
| 904 | NNLT 1 | `ATT-01` | HIGH | Vắng 9/45 = đúng 20%, chưa vượt nên là HIGH |
| 905 | Logic học | `LMS-01` | HIGH | Không làm TN01, TN02 (đã quá hạn) |
| 906 | Logic học | `LMS-02` | MEDIUM | TN02 = 4,5/10; TN01 = 4/10 (lượt cao nhất trong 2 lượt) — cả 2 < 50% |
| 908 | NNLT 1 | `LMS-03` | HIGH | Không nộp TH01, TH02 (đã quá hạn) |
| 909 | NNLT 1 | `LMS-04` | LOW | Nộp trễ TH01 (27/09 > hạn 25/09), TH02 (07/10 > 05/10) |
| 910 | CSDL | `ATT-01` | MEDIUM | Vắng 5/45 = 11,1% |
| 910 | CSDL | `LMS-03` | MEDIUM | Không nộp TH01 |
| 910 | CSDL | `COMB-01` | CRITICAL | Điểm danh + thực hành cùng ≥ MEDIUM |
| 911 | CSDL | `ATT-01` | MEDIUM | Vắng 5/45 = 11,1% |
| 911 | CSDL | `LMS-04` | LOW | Nộp trễ TH01, TH02 |
| 913 | Logic học | `ATT-01` | CRITICAL | Vắng 8/30 = 26,7% |
| 913 | Logic học | `ATT-02` | HIGH | Vắng không phép 4 → 8: tăng 4 tiết ≥ 10% × 30 = 3 |

**PHẢI KHÔNG có** ở chạy 1:

| Sinh viên | Vì sao không |
|---|---|
| 901 | Đối chứng, không có tín hiệu |
| 904 | `ATT-02`: tăng 5 → 9 = 4 tiết < 4,5 (10% của 45) |
| 902 | `ATT-02`: tăng 1 tiết |
| 907 | Vắng 1/30 = 3,3%; `LMS-02`: TN01 = 5/10 đúng 50% (luật là `< 50%`) |
| 911 | `COMB-01`: `LMS-04` mức LOW không tính |
| 912 | TH03 "Chưa nộp" nhưng hạn 14/10 chưa tới |
| 920 | Vắng có phép 4/45 = 8,9% < 10% |
| mọi sinh viên | Cơ sở dữ liệu không có trắc nghiệm → `LMS-01/02` không xét; Logic học không có thực hành → `LMS-03/04` không xét; chưa có kết quả → `ACA-*` không xét |

## Chạy 2 (asOf 2025-11-20) — Logic học đã khóa điểm

Logic học `COMPLETED` với mọi sinh viên → luật điểm danh/LMS của Logic học không chạy nữa (dấu hiệu cũ của học phần này không còn là dấu hiệu hiện tại). Điểm danh NNLT 1, CSDL (ngày chốt 09/10) đã quá 14 ngày → `STALE`: luật điểm danh không chạy, dấu hiệu điểm danh cũ (và `COMB-*`) của 2 học phần này được GIỮ. `ACA-02/03` chưa xét (sinh viên còn học phần chưa có kết quả).

Dấu hiệu mới của lần chạy:

| Sinh viên | Học phần | Luật | Mức | Vì sao |
|---|---|---|---|---|
| 908 | NNLT 1 | `LMS-03` | HIGH | Như chạy 1 |
| 909 | NNLT 1 | `LMS-04` | LOW | Như chạy 1 |
| 910 | CSDL | `LMS-03` | MEDIUM | Như chạy 1 |
| 911 | CSDL | `LMS-04` | LOW | Như chạy 1 |
| 912 | NNLT 1 | `LMS-03` | MEDIUM | TH03 hết hạn 14/10, vẫn chưa nộp |
| 913 | Logic học | `ACA-01` | HIGH | Điểm F — không được dự thi |
| 914 | Logic học | `ACA-01` | HIGH | Điểm F — vắng thi |
| 919 | Logic học | `ACA-01` | HIGH | Điểm F |

## Chạy 3 — chốt học kỳ (`TERM_CLOSING`, asOf 2025-12-31)

Mọi học phần `COMPLETED` trừ KTPM2411919 · CSDL (còn `REGISTERED`, điểm danh `STALE`, đã nộp đủ thực hành → không dấu hiệu). `ACA-02/03` chạy vì là lần chạy chốt học kỳ. `ACA-04`: học kỳ liền trước không có trong hệ thống → không xét. ĐTB hệ 4: A = 3,8.

| Sinh viên | Phạm vi | Luật | Mức | Vì sao |
|---|---|---|---|---|
| 903 | NNLT 1 | `ACA-01` | HIGH | F — không được dự thi |
| 903 | sinh viên | `ACA-02` | HIGH | Rớt 3/8 tín chỉ = 37,5% |
| 903 | sinh viên | `ACA-03` | HIGH | ĐTB = (3×2 + 0×3 + 3×3)/8 = 1,88 |
| 908 | sinh viên | `ACA-03` | HIGH | ĐTB = (3×2 + 1×3 + 2×3)/8 = 1,88 |
| 913 | Logic học | `ACA-01` | HIGH | F — không được dự thi |
| 913 | sinh viên | `ACA-02` | HIGH | Rớt 2/8 = đúng 25% |
| 914 | Logic học | `ACA-01` | HIGH | F — vắng thi |
| 914 | sinh viên | `ACA-02` | HIGH | Rớt 2/8 = 25% (ĐTB 2,25 — không `ACA-03`) |
| 915 | NNLT 1 | `ACA-01` | HIGH | F |
| 915 | CSDL | `ACA-01` | HIGH | F |
| 915 | sinh viên | `ACA-02` | CRITICAL | Rớt 6/8 = 75% > 50% — chạm ngưỡng Điều 11a |
| 915 | sinh viên | `ACA-03` | CRITICAL | ĐTB = (1×2)/8 = 0,25 < 1,0 — chạm ngưỡng Điều 11b |
| 917 | sinh viên | `ACA-03` | HIGH | ĐTB = (1×2 + 1,5×3 + 2×3)/8 = 1,56, không rớt môn nào |
| 918 | CSDL | `ACA-01` | HIGH | F |
| 918 | sinh viên | `ACA-02` | HIGH | Rớt 3/8 = 37,5% |
| 918 | sinh viên | `ACA-03` | HIGH | ĐTB = (2×2 + **3,8**×3 + 0×3)/8 = 1,93 — nếu A = 4,0 thì đúng 2,0 và KHÔNG cảnh báo |
| 919 | Logic học | `ACA-01` | HIGH | F |
| 919 | sinh viên | `ACA-02` | HIGH | Rớt 2/5 tín chỉ đã có kết quả = 40%; lý do ghi "còn 1 học phần chưa có kết quả" |
| 919 | sinh viên | `ACA-03` | HIGH | ĐTB = (0×2 + 3×3)/5 = 1,8 trên 5 tín chỉ đã có kết quả |

**PHẢI KHÔNG có** ở chạy 3: 916 (C, C, C → ĐTB đúng 2,0 — luật là `< 2,0`); 901, 902, 904–907, 909–912, 920 (ĐTB ≥ 2,0, không rớt); mọi `ATT-*`/`LMS-*`/`COMB-*` (học phần đã có kết quả).

## Cảnh báo mong đợi sau mỗi lần chạy (1 cảnh báo / sinh viên / học kỳ, CVHT `GV001`)

| Sinh viên | Sau chạy 1 | Sau chạy 2 | Sau chạy 3 |
|---|---|---|---|
| 902 | MEDIUM (`ATT-01`) | MEDIUM, không còn dấu hiệu | MEDIUM, không còn dấu hiệu |
| 903 | CRITICAL (`ATT-01`, `ATT-02`) | CRITICAL (giữ — điểm danh quá hạn) | **HIGH** (`ACA-01`, `ACA-02`, `ACA-03`) |
| 904 | HIGH (`ATT-01`) | HIGH (giữ) | HIGH, không còn dấu hiệu |
| 905 | HIGH (`LMS-01`) | HIGH, không còn dấu hiệu | như chạy 2 |
| 906 | MEDIUM (`LMS-02`) | MEDIUM, không còn dấu hiệu | như chạy 2 |
| 908 | HIGH (`LMS-03`) | HIGH (`LMS-03`) | HIGH (`ACA-03`) |
| 909 | LOW (`LMS-04`) | LOW (`LMS-04`) | LOW, không còn dấu hiệu |
| 910 | CRITICAL (`ATT-01`, `LMS-03`, `COMB-01`) | CRITICAL (`ATT-01`, `COMB-01` giữ + `LMS-03`) | CRITICAL, không còn dấu hiệu |
| 911 | MEDIUM (`ATT-01`, `LMS-04`) | MEDIUM (`ATT-01` giữ + `LMS-04`) | MEDIUM, không còn dấu hiệu |
| 912 | — | **mới** MEDIUM (`LMS-03`) | MEDIUM, không còn dấu hiệu |
| 913 | CRITICAL (`ATT-01`, `ATT-02`) | **HIGH** (`ACA-01`) | HIGH (`ACA-01`, `ACA-02`) |
| 914 | — | **mới** HIGH (`ACA-01`) | HIGH (`ACA-01`, `ACA-02`) |
| 915 | — | — | **mới** CRITICAL (`ACA-01` ×2, `ACA-02`, `ACA-03`) |
| 917 | — | — | **mới** HIGH (`ACA-03`) |
| 918 | — | — | **mới** HIGH (`ACA-01`, `ACA-02`, `ACA-03`) |
| 919 | — | **mới** HIGH (`ACA-01`) | HIGH (`ACA-01`, `ACA-02`, `ACA-03`) |

Tổng: 10 → 13 → 16 cảnh báo, tất cả `OPEN`. Mức giảm (903, 913) không gửi thông báo. Thông báo: chạy 1 = 10 `IN_APP` + 9 `EMAIL` (909 mức LOW chỉ `IN_APP`); chạy 2 = 3 + 3; chạy 3 = 3 + 3. Chạy lại cùng mốc: KHÔNG thêm cảnh báo, không gửi thông báo mới.

Sau chạy 3: `HK1_2025` đã chốt — không nạp thêm, không chạy đánh giá được (demo:reset đưa về chưa chốt).

## Kiểm tra phân quyền bằng tay

- Đăng nhập `GV001`: thấy cảnh báo của sinh viên `KTPM2411*`.
- Đăng nhập `GV002`: không thấy cảnh báo nào (lớp `CNTT2411` chưa có sinh viên).
- Admin đổi CVHT lớp `KTPM2411` sang `GV002` → mọi cảnh báo đang mở chuyển sang `GV002`; `GV001` mất quyền xem ngay.
- Sinh viên chưa có trong `01_sinh_vien.csv` đăng nhập Google → trang "Chưa có hồ sơ".
- Đăng nhập nhanh sinh viên demo: `KTPM2411903` (có cảnh báo), `KTPM2411901` (không cảnh báo) — chỉ thấy cảnh báo sau khi CVHT xác nhận.

## Sinh lại dữ liệu

File CSV được sinh bằng script Python lưu kèm ở `docs/demo-data/gen_demo_v2.py` (`python -I docs/demo-data/gen_demo_v2.py .`). Sửa kết quả mong đợi ở đây TRƯỚC, rồi mới sửa script/dữ liệu.
