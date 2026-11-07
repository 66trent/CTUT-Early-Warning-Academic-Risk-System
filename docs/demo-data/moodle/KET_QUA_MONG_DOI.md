# Kết quả mong đợi — đồng bộ Moodle demo (Phase 10b)

Nguồn: kịch bản `scripts/lib/moodle-demo-spec.ts` ở **ngày chốt 06/11/2026** (`FIXTURE_CUTOFF`; phản hồi web service ghi ở `tests/fixtures/moodle/`). Viết TRƯỚC khi code (`02`). Test nghiệm thu: `tests/integration/moodle-sync-acceptance.test.ts` (máy chủ Moodle giả đọc fixture, mã sinh viên/lớp đổi sang tiền tố thử `TST`).

## 1. Thiết lập

- Học kỳ `HK1_2026` (17/08–27/12/2026), lớp KTPM2411 (20 sinh viên), 2 khóa học Moodle được **bật** liên kết:
  - Mạng máy tính — Course ID number `010100089201` → học phần `0101000892`, tên "Mạng máy tính".
  - Hệ điều hành — `010100089101` → `0101000891`, tên "Hệ điều hành".
- Thêm 1 người dùng Moodle KHÔNG có trong EWARS (test thêm vào danh sách ghi danh giả) → bỏ qua, đếm 1 ở "sinh viên Moodle chưa có trong EWARS", KHÔNG có dòng lỗi.
- Giảng viên (`gv.moodle`, vai Teacher) không sinh dòng nào.

## 2. Đồng bộ (Chạy tay) → 3 lô `STAGED`, nguồn `MOODLE`, mỗi lô 2 file

| Lô | Dòng hợp lệ | Lỗi | Ghi chú |
|---|---|---|---|
| Điểm danh | 480 = 20 SV × 12 ngày chốt × 2 khóa | 0 | Ngày chốt = ngày có buổi đã điểm danh (MMT thứ Ba 18/08 → 03/11, HĐH thứ Năm 20/08 → 05/11); `tong_so_tiet` = 15 buổi × 200 phút ÷ 50 = **60** |
| Trắc nghiệm | **121** | 0 | Mỗi lượt làm 1 dòng; SV không có lượt nào ở 1 bài = 1 dòng "Chưa làm" (2a) |
| Thực hành | **120** | 0 | Mỗi (bài, SV) 1 dòng; gia hạn riêng ghi cột `han_rieng` (2b) |

2a. Trắc nghiệm — số dòng theo bài: MMT TN01 20 (20 lượt nộp), TN02 20 (19 nộp + 917 "Đang làm"), TN03 20 (chưa tới hạn, tất cả "Chưa làm"); HĐH TN01 21 (19 lượt của 19 SV + lượt 2 của 919 + 905 "Chưa làm"), TN02 20 (19 nộp + 905 "Chưa làm"), TN03 20 "Chưa làm" → **121**. Hạn nộp = `duedate` của Moodle (15/09, 13/10 23:59; TN03 16/11 23:59). Điểm quy về thang `grade` = 10.

2b. Thực hành — mỗi (bài, SV) 1 dòng → **120** dòng. 915 (MMT TH02) được gia hạn: dòng "Chưa nộp" kèm `han_rieng` 13/11/2026 23:59 (Moodle *Grant extension*). Trạng thái: nộp ≤ hạn → Đã nộp; nộp > hạn → Nộp trễ (909 MMT TH01 24/09, TH02 22/10); chưa nộp → Chưa nộp (907 MMT TH01, TH02; 913 HĐH TH01; 18 SV mỗi khóa ở TH03 chưa tới hạn).

> Số dòng test so khớp chính xác: **480 · 121 · 120**.

Đồng bộ lại lần 2 khi Moodle không đổi → 3 file trùng checksum lô đã nạp → **"Không có thay đổi"**, không tạo lô mới (sau khi đã xác nhận nạp lần 1).

## 3. Xác nhận nạp cả 3 → chạy đánh giá học kỳ `HK1_2026`, mốc 06/11/2026 23:59

**12 dấu hiệu, 9 cảnh báo** (mức cảnh báo = mức cao nhất):

| SV | Học phần | Dấu hiệu | Mức | Vì sao |
|---|---|---|---|---|
| 903 | MMT | `ATT-01` | CRITICAL | Không phép 16/60 = 26,7% > 20% |
| 904 | HĐH | `ATT-01` | MEDIUM | 8/60 = 13,3% |
| 904 | HĐH | `ATT-02` | HIGH | Ngày chốt 05/11 = 8, ngày chốt cũ nhất trong 14 ngày (22/10) = 0 → tăng 8 ≥ 10% × 60 = 6 |
| 905 | HĐH | `LMS-01` | HIGH | Bỏ 2 bài đã quá hạn (TN01, TN02) |
| 906 | MMT | `ATT-01` | MEDIUM | Có phép 8/60 = 13,3% (`countExcused`) |
| 907 | MMT | `LMS-03` | HIGH | 2 bài thực hành quá hạn chưa nộp |
| 909 | MMT | `LMS-04` | LOW | 2 bài nộp trễ |
| 911 | HĐH | `LMS-02` | MEDIUM | 2 bài gần nhất 4/10, 3/10 < 50% |
| 913 | HĐH | `ATT-01` | MEDIUM | 8/60 = 13,3% |
| 913 | HĐH | `LMS-03` | MEDIUM | TH01 quá hạn chưa nộp |
| 913 | HĐH | `COMB-01` | CRITICAL | Điểm danh + thực hành cùng ≥ MEDIUM trong HĐH |
| 917 | MMT | `LMS-01` | MEDIUM | TN02 chỉ có lượt "Đang làm", quá hạn → coi là bỏ bài |

Cảnh báo: 903 CRITICAL · 904 HIGH · 905 HIGH · 906 MEDIUM · 907 HIGH · 909 LOW · 911 MEDIUM · 913 CRITICAL · 917 MEDIUM.

PHẢI KHÔNG: `903` `ATT-02` (ngày chốt cũ nhất trong 14 ngày 20/10 = 12 → tăng 4 < 6) · `913` `ATT-02` (vắng 10/09, 01/10 — không có 2 buổi trong 14 ngày) · `906` `ATT-02` (vắng có phép, ATT-02 chỉ tính không phép) · `915` (`LMS-03`: hạn riêng TH02 13/11 chưa qua tại mốc 06/11 → chưa tính "không nộp") · `919` `LMS-02` (TN01 lấy lượt cao nhất 9/10) · `911` MMT (điểm 7–10) · mọi SV ở `TN03`/`TH03` (chưa tới hạn) · `COMB-02` (KTPM2411 chưa học 2 môn này trước đó; MMT ở bộ v3 là lớp CNTT2411) · `ACA-*` (chưa có kết quả học phần HK1_2026) · 11 SV còn lại (901, 902, 908, 910, 912, 914, 916, 918, 920 và 2 SV trên ở môn còn lại) không có dấu hiệu.

## 4. Không phụ thuộc ngày dựng

Dựng Moodle ở ngày chốt khác (05/11–20/12/2026) cho cùng danh sách 12 dấu hiệu / 9 cảnh báo khi chạy đánh giá với mốc = ngày chốt (bất biến kiểm ở `tests/unit/data-import/moodle-demo-spec.test.ts`); chỉ số dòng điểm danh tăng theo số buổi đã học.
