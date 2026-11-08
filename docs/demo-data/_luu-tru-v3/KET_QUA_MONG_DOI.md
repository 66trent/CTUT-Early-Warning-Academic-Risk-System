# Bộ dữ liệu demo v3 — thứ tự nạp và kết quả mong đợi

Bộ dữ liệu này vừa là **kịch bản demo** khi bảo vệ, vừa là **test nghiệm thu** (`docs/rules/02`). Phiên bản 3 (Phase 9b, chốt 2026-10-23): **toàn Khoa CNTT khóa 2024** — 5 lớp, mỗi lớp 20 sinh viên và **1 chủ đề tình huống**; học phần lấy từ chương trình khung thật (`chuong-trinh-khung-ktpm.md`); thêm học kỳ trước `HK3_2024` (chỉ kết quả học phần). Bộ cũ: `_luu-tru-v2/` (1 lớp), `_luu-tru-v1/` (định dạng cũ).

Mọi con số dưới đây tính TAY theo `08` với ngưỡng mặc định. Họ tên, MSSV là GIẢ (dải `<lớp>901`–`920`). Sửa kết quả mong đợi ở đây TRƯỚC, rồi mới sửa script / dữ liệu (`gen_demo_v3.py`).

**Giới hạn của bộ demo (ghi khi trình bày):** mỗi lớp chỉ mô phỏng **3–4 học phần** của học kỳ (≈ 7–11 tín chỉ; HK4 thật 17 TC) → tỷ lệ tín chỉ rớt (`ACA-02`) và ĐTB (`ACA-03`) tính trên số tín chỉ đó. Học phần của 4 ngành ngoài KTPM mượn từ chương trình KTPM (giả định — chưa có chương trình khung các ngành này). Không có học phần GDTC / GDQP (`08`).

## Quy ước "sinh viên sạch"

Mỗi lớp có 6–8 sinh viên tình huống (bảng từng lớp); **mọi sinh viên còn lại là sinh viên sạch theo thiết kế**: vắng 0 tiết; làm mọi bài trắc nghiệm trước hạn, điểm 8/10 (KTPM giữ như v2: `901`, `920` được 9/10); nộp mọi bài thực hành trước hạn 2 ngày (bài hạn 14/10 nộp 08/10); điểm chữ **B** mọi học phần HK1_2025 và HK3_2024. → không có dấu hiệu nào ở mọi lần chạy, `ACA-04` không kích hoạt (ĐTB không đổi). Test so khớp TOÀN BỘ tập dấu hiệu của 100 sinh viên: thừa hay thiếu đều là lỗi.

## Dữ liệu nền (`npm run seed:demo`, chỉ khi `DEMO_MODE=true`)

| Lớp | Ngành | CVHT | Chủ đề |
|---|---|---|---|
| `CNTT2411` | Công nghệ thông tin | `GV002` | Bài LMS (trắc nghiệm, thực hành) |
| `KTPM2411` | Kỹ thuật phần mềm | `GV001` | Điểm danh + bộ tình huống v2 — kịch bản chính |
| `HTTT2411` | Hệ thống thông tin | `GV003` | Học lực + học lại |
| `KHMT2411` | Khoa học máy tính | `GV004` | Nhiều nguồn cùng xấu + vòng đời cảnh báo |
| `KHDL2411` | Khoa học dữ liệu | `GV005` | Thiếu dữ liệu, sinh viên chuyển đến, bỏ học phần |

Khoa `K.CNTT`, khóa `2024` (học kỳ đầu khóa `HK1_2024` — không phải 2 học kỳ demo → ngưỡng ĐTB thường 1,0). Học kỳ: `HK3_2024` (2025-05-04 → 2025-08-10, HK3 chương trình khung) và `HK1_2025` (2025-08-18 → 2025-12-28, **hiện tại**, HK4 chương trình khung). Học kỳ đã qua để mọi mốc demo ở quá khứ.

## Học phần `HK1_2025`

Lớp học phần = mã học phần + số thứ tự lớp: `01` CNTT · `02` KTPM (`010100240802` là mã thật) · `03` HTTT · `04` KHMT · `05` KHDL. Số tiết = LT + TH. Trắc nghiệm (TN) và thực hành (TH) kèm hạn nộp.

| Học phần | Mã | TC | Tiết | Lớp học | TN (hạn) | TH (hạn) |
|---|---|---|---|---|---|---|
| Logic học | `0101002408` | 2 | 30 | CNTT, KTPM, HTTT, KHMT | TN01 20/09 · TN02 04/10 | — |
| Hệ quản trị cơ sở dữ liệu | `0101000900` | 3 | 60 | KTPM, HTTT | TN01 27/09 · TN02 08/10 | TH01 25/09 · TH02 05/10 · TH03 14/10 |
| Phân tích và thiết kế HTTT | `0101000902` | 3 | 60 | KTPM, HTTT | — | TH01 30/09 · TH02 07/10 |
| Kiến trúc máy tính | `0101000890` | 3 | 60 | CNTT | TN01 27/09 · TN02 08/10 | TH01 30/09 · TH02 07/10 |
| Mạng máy tính* | `0101000892` | 3 | 60 | CNTT | — | TH01 25/09 · TH02 05/10 · TH03 14/10 |
| Cơ sở dữ liệu (học lại) | `0101000894` | 3 | 60 | HTTT (903, 904, 905 — lớp học phần `010100089401`) | — | TH01 30/09 · TH02 07/10 |
| Giải thuật | `0101002318` | 2 | 30 | KHMT | TN01 27/09 · TN02 08/10 | — |
| Trí tuệ nhân tạo* | `0101000896` | 3 | 60 | KHMT | TN01 27/09 · TN02 08/10 | TH01 25/09 · TH02 05/10 · TH03 14/10 |
| Xác suất và thống kê | `0101000773` | 2 | 30 | KHDL | — (không dùng LMS) | — |
| Tư tưởng Hồ Chí Minh | `0101002336` | 2 | 30 | KHDL | TN01 20/09 · TN02 04/10 | — |
| Phân tích cơ sở dữ liệu lớn* | `0101002299` | 3 | 60 | KHDL | — | TH01 30/09 · TH02 07/10 |

`*` mượn từ học kỳ sau của KTPM (giả định). Tín chỉ / lớp: CNTT 8 · KTPM 8 · HTTT 8 (+3 với sinh viên học lại) · KHMT 8 · KHDL 7. Mã học phần để trống trong file (tự suy), TRỪ file Cơ sở dữ liệu học lại và kết quả `HK3_2024` ghi rõ `ma_hoc_phan` (học lại không phụ thuộc giả định "bỏ 2 số cuối").

`HK3_2024` (kết quả, công bố 2025-08-15): Toán rời rạc `0101000889` 3 TC · Cơ sở dữ liệu `0101000894` 3 · Lập trình hướng đối tượng `0101000895` 3 · Cấu trúc dữ liệu `0101002295` 2 · Chủ nghĩa xã hội khoa học `0101002335` 2 · Anh văn căn bản 3 `0101000714` 3 = 16 TC; cả 5 lớp, trừ 3 sinh viên KHDL chuyển đến (`918`, `919`, `920`).

## File và thứ tự nạp (`npm run demo:load`, học kỳ chọn trên form)

File như trường xuất: **1 file / lớp học phần / nguồn** (điểm danh: thêm 1 file / ngày chốt) → mỗi bước là 1 lô nhiều file (Phase 8f). **Nạp hết rồi mới chạy 3 mốc**: mốc `asOf` chỉ dùng dữ liệu đến ngày đó (chống rò rỉ thời gian — kết quả công bố 16/11, 28/12 không ảnh hưởng chạy 1).

| Bước | Thư mục / file | Học kỳ | Kết quả nạp mong đợi |
|---|---|---|---|
| 1 | `01_sinh_vien.csv` | — | 100 sinh viên, 0 lỗi |
| 2 | `02_HK3_2024_ket_qua/` (30 file) | `HK3_2024` | 582 dòng (97 SV × 6), 0 lỗi |
| 3 | `03_HK1_2025_diem_danh/` (32 file: 16 lớp học phần × 2 ngày chốt 02/10, 09/10) | `HK1_2025` | 600 dòng, 0 lỗi, **1 cảnh báo `NAME_MISMATCH`** (KTPM2411920 · PTTK HTTT · 09/10 ghi "Tuấn", hệ thống "Tú") |
| 4 | `04_HK1_2025_trac_nghiem/` (10 file) | `HK1_2025` | 400 dòng, 0 lỗi |
| 5 | `05_HK1_2025_thuc_hanh/` (9 file) | `HK1_2025` | 404 dòng, 0 lỗi |
| 6 | `06_HK1_2025_ket_qua_logic_hoc/` (4 file, công bố 16/11) | `HK1_2025` | 80 dòng, 0 lỗi |
| 7 | `07_HK1_2025_ket_qua_cuoi_ky/` (12 file, công bố 28/12) | `HK1_2025` | 219 dòng, 0 lỗi; thiếu **KTPM2411919 · PTTK HTTT** và **KHDL2411903 · Phân tích CSDL lớn** |
| 8 | **Chạy 1** — `MANUAL`, **asOf = 2025-10-10** | | xem "Chạy 1" từng lớp |
| 9 | **Chạy 2** — `MANUAL`, **asOf = 2025-11-20** | | xem "Chạy 2" |
| 10 | **Chốt học kỳ** → hộp thoại liệt kê **2 sinh viên thiếu kết quả** (bước 7) → **Chạy 3** `TERM_CLOSING`, **asOf = 2025-12-31** → `closedAt` | | xem "Chạy 3" |

Số dòng điểm danh mỗi ngày chốt: CNTT 60 · KTPM 60 · HTTT 63 (+3 SV học lại CSDL) · KHMT 60 · KHDL 57 (`919` không có trong file điểm danh, chỉ học XSTK) = 300. `HK3_2024` không chạy đánh giá, không chốt. Chế độ demo không tự chạy sau nạp. File minh họa nhập lỗi (không nạp khi `demo:reset`): `minh-hoa-loi/`.

---

## Lớp KTPM2411 (GV001) — điểm danh + bộ tình huống v2

Giữ ý đồ từng tình huống của v2, đổi học phần: Ngôn ngữ lập trình 1 → **Hệ quản trị CSDL** (HQT, 60 tiết), Cơ sở dữ liệu → **PTTK HTTT** (PTTK, 60 tiết); số tiết vắng tính lại theo 60 tiết. Tín chỉ (2 + 3 + 3) như v2 → mọi phép tính học lực giữ nguyên.

Dữ liệu tình huống — điểm danh (vắng có phép, không phép) tại 02/10 → 09/10: `902` Logic (1,1)→(1,2) · `903` HQT (2,3)→(2,11) · `904` HQT (0,7)→(0,12) · `907` Logic (0,1)→(0,1) · `910` PTTK (2,5)→(2,5) · `911` PTTK (0,4)→(0,7) · `913` Logic (0,4)→(0,8) · `920` PTTK (4,0)→(4,0). Trắc nghiệm: `905` không làm Logic TN01, TN02 · `906` Logic TN01 lượt 3 và 4, TN02 4,5 · `907` Logic TN01 5, TN02 3. Thực hành: `908` không nộp HQT TH01, TH02 · `909` nộp trễ HQT TH01 (27/09), TH02 (07/10) · `910` không nộp PTTK TH01 · `911` nộp trễ PTTK TH01 (02/10), TH02 (09/10) · `912` không nộp HQT TH03 (hạn 14/10). Kết quả `HK1_2025` (Logic, HQT, PTTK): `901` A A B+ · `903` B **F** B (HQT không được dự thi) · `904` B C B · `905` D B B · `906` C B B+ · `908` B D C · `910` B C C · `911` B B C+ · `913` **F** B+ B (không được dự thi) · `914` **F** B B (vắng thi) · `915` D F F · `916` C C C · `917` D D+ C · `918` C A F · `919` F B — (thiếu PTTK) · `920` B+ B+ A · còn lại B. `HK3_2024` (6 học phần cùng 1 điểm chữ): `903`, `908`, `916`, `917`, `918`, `919` **C+**; `915` **D**; còn lại B — chọn để ĐTB không giảm ≥ 1,0 (lớp này không có tình huống `ACA-04`).

**Chạy 1 (10/10)** — 15 dấu hiệu:

| SV | Học phần | Luật | Mức | Vì sao |
|---|---|---|---|---|
| 902 | Logic | `ATT-01` | MEDIUM | 3/30 = đúng 10% |
| 903 | HQT | `ATT-01` | CRITICAL | 13/60 = 21,7% > 20% |
| 903 | HQT | `ATT-02` | HIGH | Không phép 3 → 11: tăng 8 ≥ 10% × 60 = 6 |
| 904 | HQT | `ATT-01` | HIGH | 12/60 = đúng 20% — chưa vượt |
| 905 | Logic | `LMS-01` | HIGH | Không làm 2 bài đã quá hạn |
| 906 | Logic | `LMS-02` | MEDIUM | TN01 cao nhất 4/10, TN02 4,5/10 — cả 2 < 50% |
| 908 | HQT | `LMS-03` | HIGH | Không nộp TH01, TH02 |
| 909 | HQT | `LMS-04` | LOW | Nộp trễ 2 bài |
| 910 | PTTK | `ATT-01` | MEDIUM | 7/60 = 11,7% |
| 910 | PTTK | `LMS-03` | MEDIUM | Không nộp TH01 |
| 910 | PTTK | `COMB-01` | CRITICAL | Điểm danh + thực hành cùng ≥ MEDIUM |
| 911 | PTTK | `ATT-01` | MEDIUM | 7/60 = 11,7% |
| 911 | PTTK | `LMS-04` | LOW | Nộp trễ 2 bài |
| 913 | Logic | `ATT-01` | CRITICAL | 8/30 = 26,7% |
| 913 | Logic | `ATT-02` | HIGH | Tăng 4 ≥ 10% × 30 = 3 |

PHẢI KHÔNG: `904` `ATT-02` (tăng 5 < 6) · `902` `ATT-02` (tăng 1) · `907` (vắng 3,3%; TN01 đúng 50% — luật `< 50%`) · `911` `COMB-01` (`LMS-04` mức LOW không tính) · `912` (TH03 chưa tới hạn) · `920` (vắng có phép 6,7%) · `901` đối chứng.

**Chạy 2 (20/11)** — Logic học đã khóa điểm (`COMPLETED`); điểm danh HQT, PTTK (09/10) quá 14 ngày → `STALE`: giữ dấu hiệu điểm danh / `COMB-*` cũ. 8 dấu hiệu mới: `908` HQT `LMS-03` HIGH · `909` HQT `LMS-04` LOW · `910` PTTK `LMS-03` MEDIUM · `911` PTTK `LMS-04` LOW · `912` HQT `LMS-03` MEDIUM (TH03 hết hạn) · `913` Logic `ACA-01` HIGH (F — không được dự thi) · `914` Logic `ACA-01` HIGH (F — vắng thi) · `919` Logic `ACA-01` HIGH.

**Chạy 3 (chốt, 31/12)** — 19 dấu hiệu (`ACA-04` không kích hoạt ai, xem điểm HK3 ở trên):

| SV | Phạm vi | Luật | Mức | Vì sao |
|---|---|---|---|---|
| 903 | HQT | `ACA-01` | HIGH | F — không được dự thi |
| 903 | SV | `ACA-02` | HIGH | Rớt 3/8 TC = 37,5% |
| 903 | SV | `ACA-03` | HIGH | ĐTB (3×2 + 0×3 + 3×3)/8 = 1,88 |
| 908 | SV | `ACA-03` | HIGH | ĐTB (3×2 + 1×3 + 2×3)/8 = 1,88 |
| 913 | Logic | `ACA-01` | HIGH | F — không được dự thi |
| 913 | SV | `ACA-02` | HIGH | Rớt 2/8 = đúng 25% |
| 914 | Logic | `ACA-01` | HIGH | F — vắng thi |
| 914 | SV | `ACA-02` | HIGH | Rớt 2/8 = 25% (ĐTB 2,25 — không `ACA-03`) |
| 915 | HQT | `ACA-01` | HIGH | F |
| 915 | PTTK | `ACA-01` | HIGH | F |
| 915 | SV | `ACA-02` | CRITICAL | Rớt 6/8 = 75% > 50% (Điều 11a) |
| 915 | SV | `ACA-03` | CRITICAL | ĐTB 2/8 = 0,25 < 1,0 (Điều 11b) |
| 917 | SV | `ACA-03` | HIGH | ĐTB (1×2 + 1,5×3 + 2×3)/8 = 1,56 |
| 918 | PTTK | `ACA-01` | HIGH | F |
| 918 | SV | `ACA-02` | HIGH | Rớt 3/8 = 37,5% |
| 918 | SV | `ACA-03` | HIGH | ĐTB (2×2 + **3,8**×3 + 0)/8 = 1,93 — nếu A = 4,0 thì đúng 2,0, KHÔNG cảnh báo |
| 919 | Logic | `ACA-01` | HIGH | F |
| 919 | SV | `ACA-02` | HIGH | Rớt 2/5 TC đã có kết quả = 40%; lý do ghi "còn 1 học phần chưa có kết quả" |
| 919 | SV | `ACA-03` | HIGH | ĐTB (0×2 + 3×3)/5 = 1,8 |

PHẢI KHÔNG: `916` (C C C → ĐTB đúng 2,0); mọi `ACA-04` của lớp (giảm lớn nhất: `917` 2,5 → 1,56 = 0,94 < 1,0; `915` HK3 ĐTB 1,0 chỉ mức HIGH → không "2 học kỳ liên tiếp chạm quy chế"); mọi `ATT-*`/`LMS-*`/`COMB-*` (đã có kết quả).

## Lớp CNTT2411 (GV002) — bài LMS

Học phần: Logic (`010100240801`), Kiến trúc máy tính (KTMT, `010100089001`), Mạng máy tính (Mạng, `010100089201`). Kết quả mọi sinh viên **B** (HK1 và HK3) → không có dấu hiệu học lực.

| SV | Dữ liệu tình huống |
|---|---|
| 903 | Không làm KTMT TN01, TN02; không nộp Mạng TH01, TH02 (TH03 nộp đúng hạn) |
| 904 | Không làm Logic TN02 |
| 905 | KTMT TN01 2 lượt 3 và 4,5; TN02 4 |
| 906 | KTMT TN01 5 (đúng 50%); TN02 3 |
| 907 | Nộp trễ Mạng TH01 (27/09), TH02 (07/10) |
| 908 | Không làm KTMT TN01; không nộp KTMT TH01 |
| 909 | Không nộp Mạng TH03 (hạn 14/10) |

**Chạy 1 (10/10)** — 8 dấu hiệu: `903` KTMT `LMS-01` HIGH (bỏ 2 bài) · `903` Mạng `LMS-03` HIGH (không nộp 2 bài) · `904` Logic `LMS-01` MEDIUM · `905` KTMT `LMS-02` MEDIUM (4,5/10 và 4/10) · `907` Mạng `LMS-04` LOW · `908` KTMT `LMS-01` MEDIUM · `908` KTMT `LMS-03` MEDIUM · `908` KTMT `COMB-01` CRITICAL (trắc nghiệm + thực hành cùng học phần).
PHẢI KHÔNG: `906` `LMS-02` (TN01 đúng 50%) · `909` (TH03 chưa tới hạn) · `903` `COMB-01` (2 nguồn xấu nằm ở 2 học phần khác nhau — luật xét trong 1 học phần).

**Chạy 2 (20/11)** — Logic `COMPLETED` → dấu hiệu Logic của `904` không còn; KTMT, Mạng còn học. 8 dấu hiệu: như chạy 1 trừ `904`, thêm `909` Mạng `LMS-03` MEDIUM (TH03 hết hạn).
**Chạy 3** — 0 dấu hiệu.

## Lớp HTTT2411 (GV003) — học lực + học lại

Học phần: Logic (`010100240803`), HQT (`010100090003`), PTTK (`010100090203`); `903`, `904`, `905` **học lại Cơ sở dữ liệu** (rớt ở `HK3_2024`) ở lớp học phần `010100089401` — lần học 2 do hệ thống tự đếm.

| SV | `HK3_2024` (16 TC) | Điểm danh / LMS `HK1_2025` | Kết quả `HK1_2025` (Logic, HQT, PTTK, CSDL) |
|---|---|---|---|
| 903 | CSDL **F**, còn lại B → ĐTB 39/16 = 2,44 | CSDL vắng không phép 4 → 7 | B B B, CSDL C → 2,73 |
| 904 | CSDL **F**, còn lại B → 2,44 | Không nộp CSDL TH01, TH02 | B C+ B, CSDL D → 2,32 |
| 905 | CSDL **F**, còn lại B → 2,44 | Sạch | B B B, CSDL B → 3,0 |
| 906 | B+ cả 6 → 3,5 | Sạch | C C+ C → 17,5/8 = 2,19 |
| 907 | B+ cả 6 → 3,5 | Sạch | C+ C+ C+ → 2,5 |
| 908 | Toán **F**, CSDL D, LTHĐT **F**, CTDL D, CNXH C, AV3 **F** → ĐTB 9/16 = 0,56; rớt 9/16 = 56% | Sạch | **F F** C → ĐTB 6/8 = 0,75; rớt 5/8 = 62,5% |
| 909 | C+ cả 6 → 2,5 | Sạch | B B **F** → 1,88; rớt 3/8 |
| 910 | C cả 6 → 2,0 | Sạch | C C C → 2,0 |

**Chạy 1 (10/10)** — 4 dấu hiệu: `903` CSDL `ATT-01` MEDIUM (7/60 = 11,7%) · `903` CSDL `COMB-02` HIGH (học lại lần 2, đã rớt ở Học kỳ 3, 2024–2025; MEDIUM + 1 bậc) · `904` CSDL `LMS-03` HIGH · `904` CSDL `COMB-02` CRITICAL (HIGH + 1 bậc).
PHẢI KHÔNG: `905` `COMB-02` (học lại nhưng không có dấu hiệu sa sút) · `903` `ATT-02` (tăng 3 < 6).

**Chạy 2 (20/11)** — điểm danh CSDL `STALE` → giữ `ATT-01` + `COMB-02` của `903`. 3 dấu hiệu mới: `904` CSDL `LMS-03` HIGH + `COMB-02` CRITICAL · `908` Logic `ACA-01` HIGH.

**Chạy 3 (chốt)** — 10 dấu hiệu:

| SV | Phạm vi | Luật | Mức | Vì sao |
|---|---|---|---|---|
| 906 | SV | `ACA-04` | MEDIUM | ĐTB giảm 3,5 → 2,19 (giảm 1,31 ≥ 1,0) |
| 907 | SV | `ACA-04` | MEDIUM | ĐTB giảm 3,5 → 2,5 = **đúng 1,0** (luật `≥`) |
| 908 | Logic | `ACA-01` | HIGH | F |
| 908 | HQT | `ACA-01` | HIGH | F |
| 908 | SV | `ACA-02` | CRITICAL | Rớt 5/8 = 62,5% > 50% |
| 908 | SV | `ACA-03` | CRITICAL | ĐTB 0,75 < 1,0 |
| 908 | SV | `ACA-04` | CRITICAL | 2 học kỳ liên tiếp chạm ngưỡng quy chế (HK3: ĐTB 0,56, rớt 56%) |
| 909 | PTTK | `ACA-01` | HIGH | F |
| 909 | SV | `ACA-02` | HIGH | Rớt 3/8 = 37,5% |
| 909 | SV | `ACA-03` | HIGH | ĐTB 1,88 |

PHẢI KHÔNG: `910` `ACA-03` (đúng 2,0) · `909` `ACA-04` (giảm 0,62) · `904` `ACA-04` (2,44 → 2,32) · `903`, `905` (ĐTB tăng) · `908` `ACA-04` (a) (ĐTB không giảm — chỉ có (b)).

## Lớp KHMT2411 (GV004) — nhiều nguồn + vòng đời cảnh báo

Học phần: Logic (`010100240804`), Giải thuật (GT, `010100231804`, 30 tiết), Trí tuệ nhân tạo (TTNT, `010100089604`, 60 tiết). Kết quả mọi sinh viên **B** (HK1, HK3).

| SV | Dữ liệu tình huống |
|---|---|
| 903 | TTNT vắng không phép 3 → 7; không làm TTNT TN01; không nộp TTNT TH01 |
| 904 | GT vắng không phép 2 → 5; GT TN01 4, TN02 4 |
| 905 | Không nộp TTNT TH01 và TH03 (TH02 nộp đúng hạn) |
| 906 | Không làm TTNT TN01, TN02 đúng hạn; làm TN02 ngày 15/10 (sau hạn), điểm 8 |
| 908 | TTNT vắng không phép 6 → 6; nộp trễ TTNT TH01 (27/09), TH02 (07/10) |

**Chạy 1 (10/10)** — 12 dấu hiệu: `903` TTNT `ATT-01` MEDIUM (7/60) · `LMS-01` MEDIUM (bỏ 1 bài) · `LMS-03` MEDIUM · `COMB-01` CRITICAL (3 nguồn) · `904` GT `ATT-01` HIGH (5/30 = 16,7%) · `ATT-02` HIGH (tăng 3 ≥ 3) · `LMS-02` MEDIUM · `COMB-01` CRITICAL · `905` TTNT `LMS-03` MEDIUM (TH03 chưa tới hạn) · `906` TTNT `LMS-01` HIGH (bỏ 2 bài; lượt 15/10 sau mốc không được dùng) · `908` TTNT `ATT-01` MEDIUM (6/60 = đúng 10%) · `LMS-04` LOW.
PHẢI KHÔNG: `908` `COMB-01` (`LMS-04` LOW không tính) · `903` `ATT-02` (tăng 4 < 6).

**Chạy 2 (20/11)** — điểm danh GT, TTNT `STALE` → giữ `ATT-*` / `COMB-01` cũ. 7 dấu hiệu mới: `903` TTNT `LMS-01` MEDIUM · `LMS-03` MEDIUM · `COMB-01` CRITICAL (trắc nghiệm + thực hành) · `904` GT `LMS-02` MEDIUM · `905` TTNT `LMS-03` **HIGH** (2 bài: TH01, TH03) · `906` TTNT `LMS-01` **MEDIUM** (TN02 đã làm muộn → còn bỏ 1 bài) · `908` TTNT `LMS-04` LOW.
**Chạy 3** — 0 dấu hiệu.

**Vòng đời (test tự động + kịch bản thao tác ở `demo-script.md`, `demo:reset` KHÔNG làm thay CVHT):**
- `905`: chạy 1 → MEDIUM (`OPEN`) → GV004 xác nhận, ghi can thiệp, **Đánh dấu đã giải quyết** (`RESOLVED`) → chạy 2: `LMS-03` HIGH nặng hơn mức đã ghi nhận → **`REOPENED`** + thông báo. Không có thao tác của CVHT (demo:reset): MEDIUM → HIGH, tăng mức → thông báo.
- `906`: chạy 1 HIGH → chạy 2 dấu hiệu nhẹ hơn → **giảm còn MEDIUM, KHÔNG gửi thông báo**.

## Lớp KHDL2411 (GV005) — thiếu dữ liệu, sinh viên chuyển đến, bỏ học phần

Học phần: Xác suất thống kê (XSTK, `010100077305`, **không dùng LMS**), Tư tưởng HCM (TTHCM, `010100233605`), Phân tích CSDL lớn (PTCSDL, `010100229905`). Kết quả mọi sinh viên **B**, trừ dòng dưới. `918`, `919`, `920` **chuyển đến**: không có kết quả `HK3_2024`.

| SV | Dữ liệu tình huống |
|---|---|
| 903 | PTCSDL vắng (2,6) → (4,10); **bỏ học phần** — không có kết quả PTCSDL |
| 905 | Không làm TTHCM TN02 |
| 918 | Chuyển đến; đủ dữ liệu `HK1_2025`, sạch |
| 919 | Chuyển đến; **chỉ học XSTK**, chưa có tên trong file điểm danh (cả 2 ngày chốt); có kết quả XSTK B |
| 920 | Chuyển đến; sạch |

**Chạy 1 (10/10)** — 2 dấu hiệu: `903` PTCSDL `ATT-01` CRITICAL (14/60 = 23,3%; `ATT-02`: tăng 4 < 6 → không) · `905` TTHCM `LMS-01` MEDIUM.
**Chạy 2 (20/11)** — PTCSDL `STALE` → giữ `ATT-01` của `903`. 1 dấu hiệu mới: `905` TTHCM `LMS-01` MEDIUM.
**Chạy 3 (chốt)** — 0 dấu hiệu mới; `903` PTCSDL vẫn `REGISTERED` + điểm danh `STALE` → `ATT-01` vẫn là dấu hiệu hiện tại; ĐTB `903` = 3,0 trên 4 TC (XSTK, TTHCM) — không `ACA-*`.
PHẢI KHÔNG: `ACA-04` của `918`, `919`, `920` (không có học kỳ trước → không xét).

**Mức đủ dữ liệu ở chạy 1 (RiskScore — test kiểm):** sinh viên sạch KHDL (VD `901`) = **Đủ** (điểm danh, LMS, học lực = ĐTB `HK3_2024`) · `918` = **Một phần** (thiếu học lực: chưa có kết quả học kỳ này, không có học kỳ trước) · `919` = **Chưa đủ dữ liệu**, điểm rủi ro rỗng (không có điểm danh; XSTK không dùng LMS → không áp dụng; không có học lực) — KHÔNG hiển thị như "rủi ro thấp".

**Bỏ học phần (kịch bản thao tác):** Admin → hồ sơ `KHDL2411903` → đánh dấu **rút** PTCSDL → chạy lại: không còn dấu hiệu PTCSDL; hộp thoại chốt học kỳ không liệt kê PTCSDL của `903`.

---

## Tổng hợp

| Lần chạy | KTPM | CNTT | HTTT | KHMT | KHDL | Tổng dấu hiệu của lần chạy |
|---|---|---|---|---|---|---|
| Chạy 1 (10/10) | 15 | 8 | 4 | 12 | 2 | **41** |
| Chạy 2 (20/11) | 8 | 8 | 3 | 7 | 1 | **27** |
| Chạy 3 (chốt) | 19 | 0 | 10 | 0 | 0 | **29** |

Cảnh báo (1 / sinh viên / học kỳ, tất cả `OPEN` khi không có thao tác của CVHT):

| Lớp | Sau chạy 1 | Sau chạy 2 | Sau chạy 3 |
|---|---|---|---|
| KTPM | 10: 902 M · 903 C · 904 H · 905 H · 906 M · 908 H · 909 L · 910 C · 911 M · 913 C | 13: + 912 M · 914 H · 919 H; 913 giảm C → H | 16: + 915 C · 917 H · 918 H; 903 giảm C → H; 908 H (`ACA-03`) |
| CNTT | 5: 903 H · 904 M · 905 M · 907 L · 908 C | 6: + 909 M (904 không còn dấu hiệu) | 6 (mọi cảnh báo không còn dấu hiệu) |
| HTTT | 2: 903 H · 904 C | 3: + 908 H | 6: + 906 M · 907 M · 909 H; 908 tăng H → C |
| KHMT | 5: 903 C · 904 C · 905 M · 906 H · 908 M | 5: 905 tăng M → H; 906 giảm H → M | 5 |
| KHDL | 2: 903 C · 905 M | 2 | 2 (903 giữ C) |
| **Tổng** | **24** | **29** | **35** |

Mức KTPM sau chạy 3 như v2 (903 HIGH, 904 HIGH, 910 CRITICAL, 911 MEDIUM, 912 MEDIUM, 913 HIGH, 914 HIGH, 919 HIGH, …).

Thông báo (`IN_APP` / `EMAIL`; LOW chỉ `IN_APP`; giảm mức không gửi):
- Chạy 1: 24 / 22 (909 KTPM và 907 CNTT mức LOW).
- Chạy 2: 6 / 6 — mới: KTPM 912, 914, 919 · CNTT 909 · HTTT 908; tăng mức: KHMT 905.
- Chạy 3: 7 / 7 — mới: KTPM 915, 917, 918 · HTTT 906, 907, 909; tăng mức: HTTT 908.
- Chạy lại cùng mốc: KHÔNG thêm cảnh báo, không gửi thông báo mới.

## Kiểm tra phân quyền bằng tay

- Đăng nhập GV001 … GV005: mỗi người chỉ thấy cảnh báo lớp mình (KTPM 16, CNTT 6, HTTT 6, KHMT 5, KHDL 2 sau chạy 3).
- Admin lọc Ngành = Hệ thống thông tin → 6 cảnh báo; bỏ lọc → 35.
- Đổi CVHT lớp `KTPM2411` sang `GV002` → cảnh báo đang mở của KTPM chuyển sang `GV002` (GV002 thấy 22); GV001 mất quyền ngay.
- Đăng nhập nhanh sinh viên `<lớp>903`: chỉ thấy cảnh báo sau khi CVHT lớp đó xác nhận.

## Sinh lại dữ liệu

`python -I docs/demo-data/gen_demo_v3.py .` — mọi số liệu tình huống ở trên là hằng trong script; sinh viên không có trong bảng tình huống nhận dữ liệu "sạch".
