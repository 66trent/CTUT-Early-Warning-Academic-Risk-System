# Bộ dữ liệu demo v4 — thứ tự nhập và kết quả mong đợi

Bộ dữ liệu này vừa là **kịch bản trình diễn** khi bảo vệ, vừa là **test nghiệm thu** (`docs/rules/02`). Phiên bản 4 (Phase 11 đợt 4, chốt 2026-11-08, người dùng yêu cầu làm lại để phủ toàn bộ hệ thống): Khoa CNTT, **6 lớp, 110 sinh viên**, mỗi người một họ tên, Cố vấn học tập có tên người. Bộ cũ: `_luu-tru-v3/`, `_luu-tru-v2/`, `_luu-tru-v1/`.

Mọi con số dưới đây tính TAY theo `08` với ngưỡng mặc định. Họ tên, MSSV, email là GIẢ (dải `<lớp>901`–`920`, lớp `KTPM2511` là `901`–`910`). Sửa kết quả mong đợi ở đây TRƯỚC, rồi mới sửa script / dữ liệu (`gen_demo_v4.py`).

**Giới hạn của bộ demo (ghi khi trình bày):** mỗi lớp chỉ mô phỏng **2–4 học phần** của học kỳ → tỷ lệ tín chỉ rớt (`ACA-02`) và ĐTB (`ACA-03`) tính trên số tín chỉ đó. Học phần ngoài KTPM khóa 2024 mượn từ chương trình KTPM (giả định, `chuong-trinh-khung-ktpm.md`). Không có học phần GDTC / GDQP (`08`). Không đưa vào demo trạng thái `GRADUATED` (khóa 2024 chưa tới năm tốt nghiệp, đã có test nhập).

## Ma trận bao phủ

| Phần hệ thống | Nhánh | Nơi có trong bộ demo |
|---|---|---|
| `ATT-01` | Trung bình (đúng 10%) / Cao (đúng 15%) / Cao (đúng 20%) / Rất cao | KTPM 902 / KTPM 911 (chạy 2) / KTPM 904 / KTPM 903 |
| | Chỉ vắng có phép vẫn tính | KTPM 920 |
| | Dưới ngưỡng, không báo | KTPM 907 |
| `ATT-02` | Tăng vượt / đúng ngưỡng | KTPM 903 / KHMT 904, KTPM2511 906 |
| | Tăng dưới ngưỡng / số liệu bị sửa giảm / chỉ có điểm ngoài cửa sổ 14 ngày | KTPM 904 / KHDL 906 / mọi điểm danh chạy 2 |
| `LMS-01` | 1 bài / ≥ 2 bài | CNTT 904 / KTPM 905 |
| | Bài không có hạn nộp (cách dự phòng) | KHMT 912 |
| | Làm sau hạn: mốc sau mới tính đã làm | CNTT 914, KHMT 906 |
| `LMS-02` | 2 bài dưới 50% / đúng 50% / nhiều lượt lấy cao nhất / chỉ 1 bài đã nộp | CNTT 905 / CNTT 906 / CNTT 915 / CNTT 913 |
| `LMS-03` | 1 bài / ≥ 2 bài / chưa tới hạn | KTPM 910 / KTPM 908 / KTPM 912 (chạy 1) |
| | Gia hạn riêng chưa qua, rồi quá hạn | CNTT 910 |
| `LMS-04` | ≥ 2 bài trễ / 1 bài trễ / nộp trong hạn riêng không tính trễ | KTPM 909 / CNTT 912 / CNTT 911 |
| `ACA-01` | F / không được dự thi / vắng thi | KTPM 915 / KTPM 913 / KTPM 914 |
| `ACA-02` | Đúng 25% / > 25% / đúng 50% (Cao) / > 50% (Rất cao) | KTPM 913 / KTPM 918 / KHMT 913 / KTPM 915 |
| `ACA-03` | < 2,0 / đúng 2,0 / đúng 1,0 (Cao) / < 1,0 | KTPM 917 / KTPM 916 / HTTT 913 / KTPM 915 |
| | Học kỳ đầu khóa: 0,9 Cao / đúng 0,8 Cao / < 0,8 Rất cao | KTPM2511 902 / 904 / 903 |
| | A = 3,8 làm đổi kết quả | KTPM 918 |
| `ACA-04` | Giảm > 1,0 / đúng 1,0 / 2 học kỳ liên tiếp chạm quy chế / không có học kỳ trước | HTTT 906 / 907 / 908 / KHDL 918–920, KTPM2511 |
| `COMB-01` | Điểm danh + thực hành / trắc nghiệm + thực hành / điểm danh + trắc nghiệm / 3 nguồn | KTPM 910 / CNTT 908 / KHMT 904 / KHMT 903 |
| | Nộp trễ không tính / 2 nguồn ở 2 học phần khác nhau | KTPM 911 / CNTT 903 |
| `COMB-02` | Trung bình → Cao / Cao → Rất cao / đã Rất cao giữ nguyên / học lại lần 3 | HTTT 903 / 904 / 912 / 911 |
| | Học lại nhưng không có dấu hiệu | HTTT 905 |
| Điểm thang chữ | A+, A, B+, B, C+, C, D+, D, F | HTTT 901 (A+), các lớp còn lại |
| Độ đầy dữ liệu | Đủ / Một phần / Chưa đủ | KHDL 901 / KHDL 918, KTPM2511 901 / KHDL 919 |
| `DataStatus` | `NOT_APPLICABLE` / `STALE` / `MISSING` | XSTK (không LMS) / CSDL HTTT, PTCSDL KHDL / KHDL 919 |
| Vòng đời cảnh báo | Mới, Đã xác nhận, Đang xử lý, Đã giải quyết, Bỏ qua, Mở lại, Không còn hiệu lực | KHMT (xem mục lớp) |
| Mức cảnh báo đổi | Tăng có thông báo / giảm không thông báo / không còn dấu hiệu | KTPM 911 / KHMT 906 / CNTT 904 |
| Nhập dữ liệu | 6 lỗi của `minh-hoa-loi/`, sai tên, sai tỷ lệ vắng, nhiều file 1 đợt | Mục "File minh họa lỗi" |
| Hồ sơ sinh viên | Chuyển đến / rút học phần / bảo lưu / đình chỉ / buộc thôi học | KHDL 918–920 / KHDL 903 / KHDL 916 / 917 / 915 |
| Tài khoản | Cố vấn chờ duyệt | `GV007` |

Đã có test riêng, không lặp ở đây: chạy theo 1 học phần chỉ tăng mức, lần chạy mốc cũ chỉ thêm bằng chứng, hoàn tác đợt nhập → `INVALIDATED` (`tests/integration/alerts.test.ts`, `rule-engine-acceptance.test.ts`, `imports`).

## Quy ước "sinh viên sạch"

Sinh viên không có trong bảng tình huống của lớp là sinh viên sạch nhưng số liệu vẫn khác nhau:

- **Điểm danh** (số cuối, tăng dần qua các ngày chốt): học phần 60 tiết vắng có phép `n % 3`, không phép `n % 4` (tối đa 5 < 10%); học phần 30 hoặc 45 tiết vắng tổng 1 tiết.
- **Trắc nghiệm:** điểm `7 / 8 / 9 / 6,5` theo `n % 4`, trước hạn; `n % 5 = 0` làm 2 lượt (lượt đầu thấp hơn 1 điểm).
- **Thực hành:** nộp trước hạn 2 ngày.
- **Điểm chữ:** không đổi qua các học kỳ. Lớp `KTPM2411`, `HTTT2411`: **B**. Lớp `CNTT2411`, `KHMT2411`, `KHDL2411`, `KTPM2511`: theo `n % 4`: `0` A, `1` B+, `2` B, `3` C+.

→ Không dấu hiệu ở mọi lần chạy, `ACA-04` không kích hoạt. Test so khớp TOÀN BỘ tập dấu hiệu của 110 sinh viên: thừa hay thiếu đều là lỗi.

## Dữ liệu nền (`npm run seed:demo`, chỉ khi `DEMO_MODE=true`)

| Lớp | Ngành | Khóa | Cố vấn | Chủ đề |
|---|---|---|---|---|
| `KTPM2411` | Kỹ thuật phần mềm | 2024 | `GV001` Nguyễn Hoàng Anh | Đủ loại dấu hiệu, kịch bản chính |
| `CNTT2411` | Công nghệ thông tin | 2024 | `GV002` Trần Thị Mỹ Duyên | Bài LMS, gia hạn riêng |
| `HTTT2411` | Hệ thống thông tin | 2024 | `GV003` Lê Quốc Bảo | Học lực, học lại |
| `KHMT2411` | Khoa học máy tính | 2024 | `GV004` Phạm Ngọc Hân | Nhiều nguồn, vòng đời cảnh báo |
| `KHDL2411` | Khoa học dữ liệu | 2024 | `GV005` Võ Minh Trí | Thiếu dữ liệu, chuyển đến, rút học phần, tình trạng học vụ |
| `KTPM2511` | Kỹ thuật phần mềm | 2025 | `GV006` Đỗ Thanh Tâm | Sinh viên năm nhất, học kỳ đầu khóa (10 sinh viên) |

Khoa `K.CNTT`. Tài khoản `GV007` Bùi Anh Khoa ở trạng thái **Chờ duyệt** (để xem màn hình duyệt tài khoản). Học kỳ: `HK2_2024` (2025-01-06 → 2025-04-27), `HK3_2024` (2025-05-04 → 2025-08-10), `HK1_2025` (2025-08-18 → 2025-12-28, **hiện tại**). Đều đã qua để mọi mốc trình diễn ở quá khứ. Với khóa 2025, `HK1_2025` là học kỳ đầu khóa (ngưỡng ĐTB quy chế 0,8); khóa 2024 dùng ngưỡng thường 1,0.

## Học phần `HK1_2025`

Lớp học phần = mã học phần + số thứ tự lớp: `01` CNTT · `02` KTPM (`010100240802` là mã thật) · `03` HTTT · `04` KHMT · `05` KHDL · `11` KTPM2511.

| Học phần | Mã | TC | Tiết | Lớp học | TN (hạn) | TH (hạn) |
|---|---|---|---|---|---|---|
| Logic học | `0101002408` | 2 | 30 | CNTT, KTPM, HTTT, KHMT | TN01 20/09 · TN02 04/10 | — |
| Hệ quản trị cơ sở dữ liệu (HQT) | `0101000900` | 3 | 60 | KTPM, HTTT | TN01 27/09 · TN02 08/10 | TH01 25/09 · TH02 05/10 · TH03 14/10 |
| Phân tích và thiết kế HTTT (PTTK) | `0101000902` | 3 | 60 | KTPM, HTTT | — | TH01 30/09 · TH02 07/10 |
| Kiến trúc máy tính (KTMT)* | `0101000890` | 3 | 60 | CNTT | TN01 27/09 · TN02 08/10 | TH01 30/09 · TH02 07/10 |
| Mạng máy tính (Mạng)* | `0101000892` | 3 | 60 | CNTT | — | TH01 25/09 · TH02 05/10 · TH03 14/10 |
| Cơ sở dữ liệu, học lại (CSDL) | `0101000894` | 3 | 60 | HTTT (903, 904, 905, 911, 912, lớp học phần `010100089401`) | — | TH01 30/09 · TH02 07/10 |
| Giải thuật (GT) | `0101002318` | 2 | 30 | KHMT | TN01 27/09 · TN02 08/10 · **TN03 không có hạn** (lớp làm 10/11) | — |
| Trí tuệ nhân tạo (TTNT)* | `0101000896` | 3 | 60 | KHMT | TN01 27/09 · TN02 08/10 | TH01 25/09 · TH02 05/10 · TH03 14/10 |
| Xác suất và thống kê (XSTK) | `0101000773` | 2 | 30 | KHDL | không dùng LMS | — |
| Tư tưởng Hồ Chí Minh (TTHCM) | `0101002336` | 2 | 30 | KHDL | TN01 20/09 · TN02 04/10 | — |
| Phân tích cơ sở dữ liệu lớn (PTCSDL)* | `0101002299` | 3 | 60 | KHDL | — | TH01 30/09 · TH02 07/10 |
| Toán rời rạc (Toán)* | `0101000889` | 3 | 45 | KTPM2511 | không dùng LMS | — |
| Ngôn ngữ lập trình 1 (NNLT1) | `0101002394` | 2 | 45 | KTPM2511 | không dùng LMS | — |

`*` mượn từ chương trình KTPM (giả định). `HK3_2024` (kết quả, công bố 2025-08-15): Toán rời rạc 3 TC · Cơ sở dữ liệu 3 · Lập trình hướng đối tượng 3 · Cấu trúc dữ liệu 2 · Chủ nghĩa xã hội khoa học 2 · Anh văn căn bản 3 3 = 16 TC; 5 lớp khóa 2024, trừ 3 sinh viên KHDL chuyển đến (`918`, `919`, `920`). `HK2_2024` chỉ có 1 dòng (kết quả rớt Cơ sở dữ liệu lần đầu của HTTT 911, công bố 2025-05-02), để hệ thống tự đếm lần học thứ 3. Mã học phần để trống trong file (tự suy), TRỪ file học lại và kết quả học kỳ trước ghi rõ `ma_hoc_phan`.

Điểm danh có **4 ngày chốt**: D1 12/09 · D2 26/09 · D3 09/10 · D4 13/11. Logic học kết thúc sớm nên không có D4. CSDL (HTTT) và PTCSDL (KHDL) cũng không có D4, để tạo tình huống điểm danh quá hạn ở chạy 2.

## File và thứ tự nhập (`npm run demo:load`)

File như trường xuất: **1 file / lớp học phần / nguồn** (điểm danh: 1 file / ngày chốt), mỗi bước là 1 đợt nhập nhiều file (tối đa 50 file / đợt nên điểm danh chia 2 đợt). **Nhập hết rồi mới chạy 3 mốc**: mốc chỉ dùng dữ liệu đến ngày đó (kết quả công bố 16/11, 28/12 không ảnh hưởng chạy 1).

| Bước | Thư mục / file | Học kỳ | Kết quả nhập mong đợi |
|---|---|---|---|
| 1 | `01_sinh_vien.csv` | — | 110 sinh viên, 0 lỗi |
| 2 | `02_HK2_2024_ket_qua/` (1 file) | `HK2_2024` | 1 dòng, 0 lỗi |
| 3 | `03_HK3_2024_ket_qua/` (30 file) | `HK3_2024` | 582 dòng (97 × 6), 0 lỗi |
| 4 | `04_HK1_2025_diem_danh_dot_1/` (36 file: D1, D2) | `HK1_2025` | 626 dòng, 0 lỗi |
| 5 | `05_HK1_2025_diem_danh_dot_2/` (30 file: D3, D4) | `HK1_2025` | 525 dòng, 0 lỗi, **1 cảnh báo `NAME_MISMATCH`** (KTPM2411920 · PTTK · 09/10) |
| 6 | `06_HK1_2025_trac_nghiem/` (10 file) | `HK1_2025` | 491 dòng, 0 lỗi |
| 7 | `07_HK1_2025_thuc_hanh/` (9 file) | `HK1_2025` | 402 dòng, 0 lỗi |
| 8 | `08_HK1_2025_ket_qua_logic_hoc/` (4 file, công bố 16/11) | `HK1_2025` | 80 dòng, 0 lỗi |
| 9 | `09_HK1_2025_ket_qua_cuoi_ky/` (14 file, công bố 28/12) | `HK1_2025` | 231 dòng, 0 lỗi; thiếu **KTPM2411919 · PTTK**, **KHMT2411913 · TTNT**, **KHDL2411903 · PTCSDL** |
| 10 | **Chạy 1**, tính đến **2025-10-10** | | xem "Chạy 1" từng lớp |
| 11 | **Chạy 2**, tính đến **2025-11-20** | | xem "Chạy 2" |
| 12 | **Chốt học kỳ** → hộp thoại liệt kê **3 sinh viên thiếu kết quả** → **Chạy 3** `TERM_CLOSING`, tính đến **2025-12-31** → `closedAt` | | xem "Chạy 3" |

Số dòng điểm danh mỗi ngày chốt đủ (D1, D2, D3): CNTT 60 · KTPM 60 · HTTT 65 · KHMT 60 · KHDL 48 · KTPM2511 20 = 313. D4 bỏ Logic học (80), CSDL (5), PTCSDL (16) = 212. `HK2_2024`, `HK3_2024` không chạy đánh giá, không chốt. Chế độ trình diễn không tự chạy sau nhập.

---

## Lớp KTPM2411 (GV001): đủ loại dấu hiệu

Học phần: Logic, HQT, PTTK (2 + 3 + 3 = 8 TC). Điểm danh viết (có phép, không phép) tại D1 → D2 → D3 → D4.

| SV | Điểm danh | Trắc nghiệm / thực hành | Kết quả (Logic, HQT, PTTK) | `HK3_2024` |
|---|---|---|---|---|
| 901 | sạch | sạch | A A B+ | B |
| 902 | Logic (0,1) (1,1) (1,2) | | B | B |
| 903 | HQT (1,1) (2,3) (2,11) (2,12) | | B **F** B (không được dự thi) | C+ |
| 904 | HQT (0,3) (0,7) (0,12) (0,12) | | B C B | B |
| 905 | | Không làm Logic TN01, TN02 | D B B | B |
| 906 | | Logic TN01 lượt 3 và 4, TN02 4,5 | C B B+ | B |
| 907 | Logic (0,0) (0,1) (0,1) | Logic TN01 5, TN02 3 | B | B |
| 908 | | Không nộp HQT TH01, TH02 | B D C | C+ |
| 909 | | Nộp trễ HQT TH01 (27/09), TH02 (07/10) | B | B |
| 910 | PTTK (1,2) (2,4) (2,5) (2,5) | Không nộp PTTK TH01 | B C C | B |
| 911 | PTTK (0,2) (0,4) (0,7) (0,9) | Nộp trễ PTTK TH01 (02/10), TH02 (09/10) | B B C+ | B |
| 912 | | Không nộp HQT TH03 (hạn 14/10) | B | B |
| 913 | Logic (0,2) (0,4) (0,8) | | **F** B+ B (không được dự thi) | B |
| 914 | | | **F** B B (vắng thi) | B |
| 915 | | | D F F | D |
| 916 | | | C C C | C+ |
| 917 | | | D D+ C | C+ |
| 918 | | | C A F | C+ |
| 919 | | | F B, thiếu PTTK | C+ |
| 920 | PTTK (2,0) (4,0) (6,0) (6,0), D3 file ghi sai tên | | B+ B+ A | B |

**Chạy 1 (10/10), 16 dấu hiệu:**

| SV | Học phần | Luật | Mức | Vì sao |
|---|---|---|---|---|
| 902 | Logic | `ATT-01` | Trung bình | 3/30 = đúng 10% |
| 903 | HQT | `ATT-01` | Rất cao | 13/60 = 21,7% |
| 903 | HQT | `ATT-02` | Cao | Không phép 3 → 11: tăng 8 ≥ 6 |
| 904 | HQT | `ATT-01` | Cao | 12/60 = đúng 20%, chưa vượt |
| 905 | Logic | `LMS-01` | Cao | Không làm 2 bài |
| 906 | Logic | `LMS-02` | Trung bình | Cả 2 bài dưới 50% |
| 908 | HQT | `LMS-03` | Cao | Không nộp 2 bài |
| 909 | HQT | `LMS-04` | Thấp | Nộp trễ 2 bài |
| 910 | PTTK | `ATT-01` | Trung bình | 7/60 = 11,7% |
| 910 | PTTK | `LMS-03` | Trung bình | Không nộp 1 bài |
| 910 | PTTK | `COMB-01` | Rất cao | Điểm danh + thực hành |
| 911 | PTTK | `ATT-01` | Trung bình | 7/60 = 11,7% |
| 911 | PTTK | `LMS-04` | Thấp | Nộp trễ 2 bài |
| 913 | Logic | `ATT-01` | Rất cao | 8/30 = 26,7% |
| 913 | Logic | `ATT-02` | Cao | Tăng 4 ≥ 3 |
| 920 | PTTK | `ATT-01` | Trung bình | 6/60 = đúng 10%, toàn vắng có phép |

PHẢI KHÔNG: `904` `ATT-02` (tăng 5 < 6) · `902` `ATT-02` (tăng 1) · `907` (vắng 3,3%; TN01 đúng 50%) · `911` `COMB-01` (`LMS-04` Thấp không tính) · `911` `ATT-02` (tăng 3) · `912` (TH03 chưa tới hạn) · `901` đối chứng.

**Chạy 2 (20/11), 14 dấu hiệu.** Logic đã khóa điểm. HQT, PTTK có D4 13/11 nên điểm danh còn mới; `ATT-02` không xét vì D3 đã ngoài cửa sổ 14 ngày: `903` HQT `ATT-01` Rất cao (14/60) · `904` HQT `ATT-01` Cao · `908` HQT `LMS-03` Cao · `909` HQT `LMS-04` Thấp · `910` PTTK `ATT-01` Trung bình, `LMS-03` Trung bình, `COMB-01` Rất cao · `911` PTTK `ATT-01` **Cao** (9/60 = đúng 15%), `LMS-04` Thấp · `912` HQT `LMS-03` Trung bình · `913` Logic `ACA-01` Cao · `914` Logic `ACA-01` Cao · `919` Logic `ACA-01` Cao · `920` PTTK `ATT-01` Trung bình.

**Chạy 3 (chốt, 31/12), 19 dấu hiệu:**

| SV | Phạm vi | Luật | Mức | Vì sao |
|---|---|---|---|---|
| 903 | HQT | `ACA-01` | Cao | F, không được dự thi |
| 903 | SV | `ACA-02` | Cao | Rớt 3/8 = 37,5% |
| 903 | SV | `ACA-03` | Cao | (6 + 0 + 9)/8 = 1,88 |
| 908 | SV | `ACA-03` | Cao | (6 + 3 + 6)/8 = 1,88 |
| 913 | Logic | `ACA-01` | Cao | F, không được dự thi |
| 913 | SV | `ACA-02` | Cao | Rớt 2/8 = đúng 25% |
| 914 | Logic | `ACA-01` | Cao | F, vắng thi |
| 914 | SV | `ACA-02` | Cao | Rớt 2/8 = 25% (ĐTB 2,25, không `ACA-03`) |
| 915 | HQT | `ACA-01` | Cao | F |
| 915 | PTTK | `ACA-01` | Cao | F |
| 915 | SV | `ACA-02` | Rất cao | Rớt 6/8 = 75% |
| 915 | SV | `ACA-03` | Rất cao | 2/8 = 0,25 |
| 917 | SV | `ACA-03` | Cao | (2 + 4,5 + 6)/8 = 1,56 |
| 918 | PTTK | `ACA-01` | Cao | F |
| 918 | SV | `ACA-02` | Cao | Rớt 3/8 = 37,5% |
| 918 | SV | `ACA-03` | Cao | (4 + 11,4 + 0)/8 = 1,93; nếu A = 4,0 thì đúng 2,0, không cảnh báo |
| 919 | Logic | `ACA-01` | Cao | F |
| 919 | SV | `ACA-02` | Cao | Rớt 2/5 = 40%, "còn 1 học phần chưa có kết quả" |
| 919 | SV | `ACA-03` | Cao | 9/5 = 1,8 |

PHẢI KHÔNG: `916` (đúng 2,0) · mọi `ACA-04` của lớp (giảm lớn nhất `917` 2,5 → 1,56 = 0,94; `915` học kỳ trước ĐTB 1,0 chỉ mức Cao).

## Lớp CNTT2411 (GV002): bài LMS, gia hạn riêng

Học phần: Logic, KTMT, Mạng. Mọi sinh viên có điểm chữ theo quy ước sạch → không có dấu hiệu học lực.

| SV | Dữ liệu tình huống |
|---|---|
| 903 | Không làm KTMT TN01, TN02; không nộp Mạng TH01, TH02 |
| 904 | Không làm Logic TN02 |
| 905 | KTMT TN01 2 lượt 3 và 4,5; TN02 4 |
| 906 | KTMT TN01 5 (đúng 50%); TN02 3 |
| 907 | Nộp trễ Mạng TH01 (27/09), TH02 (07/10) |
| 908 | Không làm KTMT TN01; không nộp KTMT TH01 |
| 909 | Không nộp Mạng TH03 (hạn 14/10) |
| 910 | Không nộp Mạng TH02, được gia hạn riêng đến 15/10 |
| 911 | KTMT TH01 nộp 11/10, gia hạn riêng đến 12/10; TH02 nộp trễ 08/10 |
| 912 | Nộp trễ 1 bài: Mạng TH01 (27/09) |
| 913 | KTMT TN01 điểm 3; không làm TN02 |
| 914 | Làm KTMT TN02 ngày 15/10, sau hạn, điểm 8 |
| 915 | KTMT TN01 3 lượt 2, 4, 6; TN02 điểm 3 |

**Chạy 1, 10 dấu hiệu:** `903` KTMT `LMS-01` Cao · `903` Mạng `LMS-03` Cao · `904` Logic `LMS-01` Trung bình · `905` KTMT `LMS-02` Trung bình · `907` Mạng `LMS-04` Thấp · `908` KTMT `LMS-01` Trung bình, `LMS-03` Trung bình, `COMB-01` Rất cao · `913` KTMT `LMS-01` Trung bình · `914` KTMT `LMS-01` Trung bình.

PHẢI KHÔNG: `906` `LMS-02` (TN01 đúng 50%) · `909` (TH03 chưa tới hạn) · `910` (hạn riêng chưa qua) · `911` (TH01 hạn riêng chưa qua, TH02 trễ 1 bài) · `912` (1 bài trễ) · `913` `LMS-02` (chỉ 1 bài đã nộp) · `915` `LMS-02` (TN01 lượt cao nhất 6) · `903` `COMB-01` (2 học phần khác nhau).

**Chạy 2, 10 dấu hiệu:** như chạy 1 trừ `904` (Logic đã khóa điểm) và `914` (đã làm bài muộn), thêm `909` Mạng `LMS-03` Trung bình, `910` Mạng `LMS-03` Trung bình.

PHẢI KHÔNG: `911` `LMS-04` (TH01 nộp trong hạn riêng, chỉ TH02 trễ).

**Chạy 3:** 0 dấu hiệu.

## Lớp HTTT2411 (GV003): học lực, học lại

Học phần: Logic, HQT, PTTK; 5 sinh viên học lại CSDL. Sinh viên 902, 905, 914–920 sạch (điểm B, trừ bảng).

| SV | `HK3_2024` (16 TC) | Điểm danh / LMS `HK1_2025` | Kết quả (Logic, HQT, PTTK, CSDL) |
|---|---|---|---|
| 901 | A+ cả 6 | Sạch | A+ A+ A+ |
| 903 | CSDL **F**, còn lại B → 39/16 = 2,44 | CSDL (0,1) (0,3) (0,7) | B B B, CSDL C → 30/11 = 2,73 |
| 904 | CSDL **F**, còn lại B → 2,44 | Không nộp CSDL TH01, TH02 | B C+ B, CSDL D → 25,5/11 = 2,32 |
| 905 | CSDL **F**, còn lại B → 2,44 | Sạch | B B B, CSDL B → 3,0 |
| 906 | B+ cả 6 → 3,5 | Sạch | C C+ C → 17,5/8 = 2,19 |
| 907 | B+ cả 6 → 3,5 | Sạch | C+ C+ C+ → 2,5 |
| 908 | Toán **F**, CSDL D, LTHĐT **F**, CTDL D, CNXH C, AV3 **F** → 9/16 = 0,56; rớt 9/16 = 56% | Sạch | **F F** C → 6/8 = 0,75; rớt 5/8 = 62,5% |
| 909 | C+ cả 6 → 2,5 | Sạch | B B **F** → 1,88; rớt 3/8 |
| 910 | C cả 6 → 2,0 | Sạch | C C C → 2,0 |
| 911 | CSDL **F** (`HK2_2024` cũng **F**), còn lại B → 2,44 | CSDL (0,2) (0,5) (0,9) | B B B, CSDL C → 2,73 |
| 912 | CSDL **F**, còn lại B → 2,44 | CSDL (0,3) (0,8) (0,13) | B B B, CSDL D → 27/11 = 2,45 |
| 913 | D+ cả 6 → 1,5 | Sạch | D D D → đúng 1,0 |

**Chạy 1, 8 dấu hiệu:** `903` CSDL `ATT-01` Trung bình (7/60), `COMB-02` Cao · `904` CSDL `LMS-03` Cao, `COMB-02` Rất cao · `911` CSDL `ATT-01` Cao (9/60 = đúng 15%), `COMB-02` Rất cao (học lại lần 3) · `912` CSDL `ATT-01` Rất cao (13/60), `COMB-02` Rất cao (giữ nguyên, đã cao nhất).

PHẢI KHÔNG: `905` `COMB-02` (không có dấu hiệu sa sút) · `ATT-02` của 903, 911, 912 (tăng 4, 4, 5 < 6).

**Chạy 2, 3 dấu hiệu mới:** điểm danh CSDL quá hạn nên **giữ** `ATT-01` + `COMB-02` của 903, 911, 912. Mới: `904` CSDL `LMS-03` Cao, `COMB-02` Rất cao · `908` Logic `ACA-01` Cao.

**Chạy 3, 11 dấu hiệu:**

| SV | Phạm vi | Luật | Mức | Vì sao |
|---|---|---|---|---|
| 906 | SV | `ACA-04` | Trung bình | 3,5 → 2,19 (giảm 1,31) |
| 907 | SV | `ACA-04` | Trung bình | 3,5 → 2,5 = đúng 1,0 |
| 908 | Logic | `ACA-01` | Cao | F |
| 908 | HQT | `ACA-01` | Cao | F |
| 908 | SV | `ACA-02` | Rất cao | Rớt 62,5% |
| 908 | SV | `ACA-03` | Rất cao | 0,75 |
| 908 | SV | `ACA-04` | Rất cao | 2 học kỳ liên tiếp chạm ngưỡng quy chế |
| 909 | PTTK | `ACA-01` | Cao | F |
| 909 | SV | `ACA-02` | Cao | Rớt 37,5% |
| 909 | SV | `ACA-03` | Cao | 1,88 |
| 913 | SV | `ACA-03` | Cao | Đúng 1,0: chưa dưới 1,0 |

PHẢI KHÔNG: `910` `ACA-03` (đúng 2,0) · `909` `ACA-04` (giảm 0,62) · `904` `ACA-04` · `903`, `905`, `911`, `912` (ĐTB tăng) · `913` `ACA-04` (giảm 0,5).

Lần học tự đếm ở CSDL: 903, 904, 905, 912 lần 2; 911 lần 3.

## Lớp KHMT2411 (GV004): nhiều nguồn, vòng đời

Học phần: Logic, GT (30 tiết), TTNT (60 tiết) = 7 TC.

| SV | Dữ liệu tình huống |
|---|---|
| 903 | TTNT (0,1) (0,3) (0,7) (0,7); không làm TTNT TN01; không nộp TTNT TH01 |
| 904 | GT (0,1) (0,2) (0,5) (0,5); GT TN01 4, TN02 4, TN03 3 |
| 905 | Không nộp TTNT TH01 và TH03 |
| 906 | Không làm TTNT TN01; TN02 làm 15/10, sau hạn, điểm 8 |
| 908 | TTNT (0,2) (0,4) (0,6) (0,6); nộp trễ TTNT TH01 (27/09), TH02 (07/10) |
| 910 | Không nộp TTNT TH02 |
| 912 | Không làm GT TN03 (không có hạn nộp) |
| 913 | Logic **F**, GT B, thiếu kết quả TTNT; `HK3_2024` C |

**Chạy 1, 13 dấu hiệu:** `903` TTNT `ATT-01` Trung bình, `LMS-01` Trung bình, `LMS-03` Trung bình, `COMB-01` Rất cao (3 nguồn) · `904` GT `ATT-01` Cao (5/30 = 16,7%), `ATT-02` Cao (tăng đúng 3), `LMS-02` Trung bình, `COMB-01` Rất cao · `905` TTNT `LMS-03` Trung bình (TH03 chưa tới hạn) · `906` TTNT `LMS-01` Cao · `908` TTNT `ATT-01` Trung bình (đúng 10%), `LMS-04` Thấp · `910` TTNT `LMS-03` Trung bình.

PHẢI KHÔNG: `908` `COMB-01` · `903` `ATT-02` (tăng 4 < 6) · `912` (TN03 chưa có ai làm).

**Chạy 2, 14 dấu hiệu:** `903` TTNT 4 dấu hiệu như chạy 1 · `904` GT `ATT-01` Cao, `LMS-02` Trung bình, `COMB-01` Rất cao · `905` TTNT `LMS-03` **Cao** (2 bài) · `906` TTNT `LMS-01` **Trung bình** (TN02 đã làm muộn) · `908` TTNT `ATT-01` Trung bình, `LMS-04` Thấp · `910` TTNT `LMS-03` Trung bình · `912` GT `LMS-01` Trung bình (TN03 không hạn: quá nửa lớp đã làm, lần làm đầu cách mốc ≥ 3 ngày) · `913` Logic `ACA-01` Cao.

**Chạy 3, 3 dấu hiệu:** `913` Logic `ACA-01` Cao · `913` `ACA-02` Cao (rớt 2/4 TC = **đúng 50%**, chưa vượt; "còn 1 học phần chưa có kết quả") · `913` `ACA-03` Cao (6/4 = 1,5).

**Vòng đời** (test tự động và thao tác tay ở `demo-script.md`, `demo:reset` KHÔNG làm thay Cố vấn học tập), thao tác sau chạy 1, trước chạy 2:

| SV | Thao tác của GV004 | Sau chạy 2 |
|---|---|---|
| 903 | Xác nhận, ghi can thiệp "theo dõi tiếp" → **Đang xử lý** | Đang xử lý, mức không đổi, không thông báo |
| 904 | **Xác nhận** | Đã xác nhận, không thông báo |
| 905 | Xác nhận, ghi can thiệp, **Đã giải quyết** | `LMS-03` nặng hơn → **Mở lại**, có thông báo |
| 906 | Không | **Mới**, giảm Cao → Trung bình, không thông báo |
| 908 | **Bỏ qua** (kèm lý do) | Vẫn Bỏ qua, dấu hiệu y hệt chỉ thêm bằng chứng |
| 910 | **Không còn hiệu lực** (kèm lý do) | Cảnh báo cũ giữ nguyên, dấu hiệu lặp lại tạo **cảnh báo mới** |

## Lớp KHDL2411 (GV005): thiếu dữ liệu, tình trạng học vụ

Học phần: XSTK (không dùng LMS), TTHCM, PTCSDL.

| SV | Tình huống |
|---|---|
| 903 | PTCSDL (1,2) (2,6) (4,10); **bỏ học phần**, không có kết quả PTCSDL |
| 905 | Không làm TTHCM TN02 |
| 906 | XSTK (0,1) (0,3) (0,1) (0,1): số liệu bị sửa giảm |
| 915 | **Buộc thôi học** (`DISMISSED`), không có dữ liệu học kỳ này |
| 916 | **Bảo lưu** (`RESERVED`), không có dữ liệu học kỳ này |
| 917 | **Đình chỉ** (`SUSPENDED`), không có dữ liệu học kỳ này |
| 918, 920 | Chuyển đến: không có `HK3_2024`, đủ dữ liệu học kỳ này |
| 919 | Chuyển đến, **chỉ học XSTK**, không có tên trong file điểm danh, có kết quả XSTK |

**Chạy 1, 2 dấu hiệu:** `903` PTCSDL `ATT-01` Rất cao (14/60 = 23,3%) · `905` TTHCM `LMS-01` Trung bình. PHẢI KHÔNG: `906` `ATT-02` (giảm).

**Chạy 2, 1 dấu hiệu mới:** `905` TTHCM `LMS-01` Trung bình. PTCSDL quá hạn nên giữ `ATT-01` của `903`.

**Chạy 3:** 0 dấu hiệu mới; `903` PTCSDL vẫn đang học + điểm danh quá hạn nên `ATT-01` vẫn là dấu hiệu hiện tại.

PHẢI KHÔNG: `ACA-04` của `918`, `919`, `920` (không có học kỳ trước).

**Mức đủ dữ liệu ở chạy 1:** `901` **Đủ** · `918` **Một phần** (thiếu học lực) · `919` **Chưa đủ dữ liệu**, điểm rỗng, KHÔNG hiển thị như "rủi ro thấp".

**Bỏ học phần (thao tác tay):** Admin → hồ sơ `KHDL2411903` → đánh dấu **rút** PTCSDL → chạy lại: không còn dấu hiệu PTCSDL; hộp thoại chốt không liệt kê PTCSDL của `903`.

## Lớp KTPM2511 (GV006): năm nhất, học kỳ đầu khóa

10 sinh viên, 2 học phần: Toán (3 TC) và NNLT1 (2 TC), cùng 45 tiết, không dùng LMS. Chưa có học kỳ trước → mức đủ dữ liệu **Một phần**, `ACA-04` không xét.

| SV | Tình huống | Kết quả (Toán, NNLT1) |
|---|---|---|
| 902 | | D+ **F** → 4,5/5 = 0,9; rớt 2/5 |
| 903 | | D **F** → 3/5 = 0,6; rớt 2/5 |
| 904 | | **F** C → 4/5 = đúng 0,8; rớt 3/5 |
| 905 | NNLT1 (0,1) (0,3) (0,5) (0,5) | sạch |
| 906 | Toán (0,2) (0,3) (0,8) (0,10) | sạch |

**Chạy 1, 3 dấu hiệu:** `905` NNLT1 `ATT-01` Trung bình (5/45 = 11,1%) · `906` Toán `ATT-01` Cao (8/45 = 17,8%), `ATT-02` Cao (tăng 5 ≥ 4,5).

**Chạy 2, 2 dấu hiệu:** `905` NNLT1 `ATT-01` Trung bình · `906` Toán `ATT-01` **Rất cao** (10/45 = 22,2%).

**Chạy 3, 9 dấu hiệu:** `902` NNLT1 `ACA-01` Cao, `ACA-02` Cao (40%), `ACA-03` **Cao** (0,9: các học kỳ khác sẽ là Rất cao vì < 1,0, riêng học kỳ đầu khóa ngưỡng là 0,8) · `903` NNLT1 `ACA-01` Cao, `ACA-02` Cao, `ACA-03` Rất cao (0,6) · `904` Toán `ACA-01` Cao, `ACA-02` Rất cao (60%), `ACA-03` Cao (đúng 0,8, chưa dưới).

---

## Tổng hợp

| Lần chạy | KTPM | CNTT | HTTT | KHMT | KHDL | KTPM2511 | Tổng dấu hiệu |
|---|---|---|---|---|---|---|---|
| Chạy 1 (10/10) | 16 | 10 | 8 | 13 | 2 | 3 | **52** |
| Chạy 2 (20/11) | 14 | 10 | 3 | 14 | 1 | 2 | **44** |
| Chạy 3 (chốt) | 19 | 0 | 11 | 3 | 0 | 9 | **42** |

Cảnh báo (1 / sinh viên / học kỳ, tất cả **Mới** khi không có thao tác của Cố vấn học tập). T = Thấp, TB = Trung bình, C = Cao, RC = Rất cao:

| Lớp | Sau chạy 1 | Sau chạy 2 | Sau chạy 3 |
|---|---|---|---|
| KTPM2411 | 11: 902 TB · 903 RC · 904 C · 905 C · 906 TB · 908 C · 909 T · 910 RC · 911 TB · 913 RC · 920 TB | 14: + 912 TB · 914 C · 919 C; 911 tăng C; 913 giảm C | 17: + 915 RC · 917 C · 918 C; 903 giảm C |
| CNTT2411 | 7: 903 C · 904 TB · 905 TB · 907 T · 908 RC · 913 TB · 914 TB | 9: + 909 TB · 910 TB | 9 |
| HTTT2411 | 4: 903 C · 904 RC · 911 RC · 912 RC | 5: + 908 C | 9: + 906 TB · 907 TB · 909 C · 913 C; 908 tăng RC |
| KHMT2411 | 6: 903 RC · 904 RC · 905 TB · 906 C · 908 TB · 910 TB | 8: + 912 TB · 913 C; 905 tăng C; 906 giảm TB | 8 |
| KHDL2411 | 2: 903 RC · 905 TB | 2 | 2 |
| KTPM2511 | 2: 905 TB · 906 C | 2: 906 tăng RC | 5: + 902 C · 903 RC · 904 RC |
| **Tổng** | **32** | **40** | **50** |

Thông báo (`IN_APP` / `EMAIL`; Thấp chỉ trong ứng dụng; giảm mức không gửi):

- Chạy 1: 32 / 30 (KTPM 909 và CNTT 907 mức Thấp).
- Chạy 2: 11 / 11. Mới: KTPM 912, 914, 919 · CNTT 909, 910 · HTTT 908 · KHMT 912, 913. Tăng mức: KTPM 911 · KHMT 905 · KTPM2511 906.
- Chạy 3: 11 / 11. Mới: KTPM 915, 917, 918 · HTTT 906, 907, 909, 913 · KTPM2511 902, 903, 904. Tăng mức: HTTT 908.
- Có thao tác vòng đời KHMT (test nghiệm thu): chạy 2 thành 12 / 12 (thêm cảnh báo mới của 910; 905 chuyển từ "tăng mức" sang "mở lại", cùng số).
- Chạy lại cùng mốc: KHÔNG thêm cảnh báo, không gửi thông báo mới.

## Kiểm tra phân quyền bằng tay

- Đăng nhập GV001 … GV006: mỗi người chỉ thấy cảnh báo lớp mình (sau chạy 3: 17, 9, 9, 8, 2, 5).
- Admin lọc Ngành = Hệ thống thông tin → 9 cảnh báo; Kỹ thuật phần mềm → 22 (2 lớp); bỏ lọc → 50.
- Đổi Cố vấn học tập lớp `KTPM2411` sang `GV002` → cảnh báo đang mở của KTPM chuyển sang `GV002` (GV002 thấy 26); GV001 mất quyền ngay.
- Đăng nhập nhanh sinh viên `<lớp>903`: chỉ thấy cảnh báo sau khi Cố vấn học tập lớp đó xác nhận.

## File minh họa lỗi (`minh-hoa-loi/`, không nhập khi `demo:reset`)

Mỗi file nhập thử để xem màn hình lỗi, mỗi file 1–2 dòng lỗi, còn lại hợp lệ:

| File | Loại nhập | Học kỳ | Lỗi / cảnh báo |
|---|---|---|---|
| `01_sinh_vien_sai_lop.csv` | Sinh viên | — | `CLASS_NOT_FOUND` (lớp không tồn tại) |
| `02_diem_danh_sai_ngay_va_ma_sv.csv` | Điểm danh | `HK1_2025` | `INVALID_FORMAT` (ngày kiểu Mỹ), `STUDENT_NOT_FOUND` |
| `03_diem_danh_trung_dong.csv` | Điểm danh | `HK1_2025` | `DUPLICATE` |
| `04_diem_danh_vuot_so_tiet.csv` | Điểm danh | `HK1_2025` | `OUT_OF_RANGE` (vắng nhiều hơn tổng số tiết) |
| `05_diem_danh_sai_ngoai_hoc_ky.csv` | Điểm danh | `HK1_2025` | `TERM_MISMATCH` (ngày chốt ngoài học kỳ) |
| `06_diem_danh_sai_hoc_phan.csv` | Điểm danh, chọn học phần Logic học | `HK1_2025` | `COURSE_MISMATCH` (file của học phần khác; cả file sai nên đợt nhập bị từ chối) |
| `07_diem_danh_lech_ty_le.csv` | Điểm danh | `HK1_2025` | Cảnh báo `ABSENCE_RATE_MISMATCH`, không chặn nhập |

## Sinh lại dữ liệu

`python -I docs/demo-data/gen_demo_v4.py .`: mọi số liệu tình huống ở trên là hằng trong script; sinh viên không có trong bảng tình huống nhận dữ liệu sạch.
