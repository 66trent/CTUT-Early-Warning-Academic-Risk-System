# Đối soát bộ luật và quy trình với dữ liệu thật của trường — 2026-10-18

Căn cứ: 4 ảnh hệ thống trường (bảng điểm học phần đã khóa, màn điểm danh, Moodle bài nộp) + Quy chế đào tạo 336/QĐ-ĐHKTCN (03/4/2025), so với `docs/rules/08`, `10`, `12` và giao diện hiện tại (`docs/screenshots`).

## Đã chốt với người dùng (2026-10-18)

1. Quy đổi điểm theo quy chế 336: **A = 3,8** (so sánh ĐTB bằng số nguyên phần mười).
2. Học lực: **ACA-01/02/03 theo Điều 11** như mục 1 (ACA-01 = không đạt học phần; ACA-02 theo % tín chỉ; ACA-03 thêm mức chạm ngưỡng quy chế). Không làm ĐTB tích lũy / nợ đọng. Bỏ luồng điểm giữa kỳ (`PROCESS_ONLY`).
3. Bài thực hành: **thêm LMS-03 (không nộp quá hạn) + LMS-04 (nộp trễ)**. **Hạn nộp là cột `han_nop` trong file** (không nhập trên form).
4. Điểm danh: **đổi sang đơn vị tiết, bỏ ATT-03**.
5. **1 năm học = 3 học kỳ chính (HK1, HK2, HK3), không còn học kỳ hè** → mọi học kỳ xét đủ luật (kể cả Điều 11).
6. "Học kỳ đầu khóa" (ngưỡng ĐTB < 0,8) = HK1 năm học bắt đầu bằng **khóa tuyển sinh của lớp sinh hoạt** (`AdministrativeClass.cohortYear`, đã nhập khi tạo lớp — VD 2024 → HK1 2024–2025). Ban đầu định thêm cột `khoa` ở file sinh viên; khi code thấy lớp đã có sẵn khóa nên KHÔNG cần cột mới (cập nhật 2026-10-18).
7. **Thêm ACA-04 — sa sút qua các học kỳ** (mục 6). Không có dữ liệu học kỳ liền trước của sinh viên → **không xét** (không coi là "không rủi ro").
8. **3 file học tập thêm cột tùy chọn `ho_dem`, `ten`** — không lưu lại; màn xem trước hiện tên tra từ danh sách sinh viên, tên trong file lệch → cảnh báo "có thể sai MSSV".
9. **Không có file Excel thật** (chỉ ảnh giảng viên chụp) → mẫu file thiết kế theo cột trong ảnh, tiêu đề 1 dòng (mục 6b). File xuất của trường có tiêu đề nhiều tầng → Admin dán dữ liệu vào mẫu. Ghi vào "Giới hạn đã biết".
10. Mã học phần = **mã lớp học phần bỏ 2 số cuối** (`010100240802` → `0101002408`) — người dùng "khá chắc", CHƯA xác nhận chính thức → mẫu cho phép điền `ma_hoc_phan` riêng; trống thì tự suy và hiện ở màn xem trước để Admin kiểm.
11. Không xử lý điểm chữ đặc biệt (I, R…) — chỉ A+…F.

Chưa cập nhật `docs/rules/08`, `09`, `10`, `12` và code — làm ở bước đầu của phase điều chỉnh, theo mục 6 và 6b.

Ký hiệu: **[SAI]** sai so với quy chế/dữ liệu thật, phải sửa · **[LỆCH]** dữ liệu thật khác định dạng hệ thống đang nhận · **[THIẾU]** cần bổ sung · **[HỎI]** cần người dùng cung cấp/xác nhận.

---

## 0. Phát hiện nghiêm trọng nhất (sửa trước mọi thứ khác)

1. **[SAI] Quy đổi điểm A = 4,0 — quy chế 336 ghi A = 3,8.** Ảnh 1 cũng ra A → 3,80. Hệ thống đang dùng A = 4 (`aca-03.ts`, `08`, `HANDOFF`), và Zod còn ép bội số 0,5 (`multipleOf(0.5)`) nên không nhập được 3,8. Cách so sánh "nửa điểm bằng số nguyên" (`2 × điểm × tín chỉ`) cũng phải đổi sang phần mười (`10 × điểm`). Ảnh hưởng: ĐTB học kỳ (`ACA-03`) của sinh viên có điểm A bị tính cao hơn thực tế.
2. **[LỆCH] Mã học phần.** Cả 3 nguồn của trường dùng **mã lớp học phần** (`010100240802`, `010100239403`), Moodle không có mã nào. Hệ thống ghép 3 nguồn và nhận diện **học lại** theo `ma_hoc_phan`. Nếu nạp mã lớp học phần (đổi mỗi học kỳ) thì: 3 nguồn không ghép được với nhau, và học lại (`COMB-02`) **không bao giờ** phát hiện được.
3. **[LỆCH] Điểm danh của trường tính theo TIẾT, không theo buổi; không có cột đi trễ, có mặt, số buổi đã học.**
4. **[LỆCH] File điểm của trường không có điểm tổng kết thang 10 và số tín chỉ** — có thang điểm 4, điểm chữ, được dự thi, vắng thi.

---

## 1. Kết quả học tập (ảnh 1 + quy chế Điều 11)

### Dữ liệu thật so với mẫu hiện tại

| Cột file trường | Mẫu hệ thống | Nhận xét |
|---|---|---|
| Mã sinh viên | `mssv` | Khớp |
| LHP `[010100240802] - Logic học (KTPM2411)` (dòng tiêu đề, không phải cột) | `ma_hoc_phan`, `ten_hoc_phan` | **[LỆCH]** mã nằm ở tiêu đề; là mã LỚP học phần |
| Thường xuyên 40% (LT hệ số 1, có thể nhiều cột) | `diem_qua_trinh` | Không cần cho cảnh báo nữa (xem dưới) |
| Được dự thi (ô tích) | — | **[THIẾU]** tín hiệu mạnh: không được dự thi = bị cấm thi |
| Cuối kỳ | `diem_thi` | Khớp |
| Vắng thi (ô tích), Vi phạm quy chế thi | — | **[THIẾU]** tín hiệu rủi ro |
| Thang điểm 4 | — (hệ thống tự quy đổi) | Dùng để đối chiếu, lệch thì cảnh báo nhập liệu |
| Điểm chữ | `diem_chu` | Khớp |
| Xếp loại | — | Bỏ qua. Lưu ý: file ghi C+ (2,5) = "Trung bình", quy chế ghi 2,5 = "Khá" → nhãn trong file không theo thang xếp loại học kỳ |
| (không có) | `diem_tong_ket`, `so_tin_chi`, `ket_qua` | **[THIẾU]** tín chỉ bắt buộc cho ĐTB; `ket_qua` suy từ điểm chữ (F = không đạt) |
| Họ đệm, Tên, Giới tính, Lớp | — | Bỏ qua (tối thiểu hóa dữ liệu cá nhân) |

File có **tiêu đề 2–3 tầng (ô gộp)** và **dòng tiêu đề lớp học phần** phía trên → bộ đọc hiện tại (1 dòng tiêu đề) không đọc được. Cần bộ đọc riêng cho "file xuất của trường".

### Hệ quả quyết định "chỉ nạp khi học phần đã khóa điểm"

- `ACA-01` (điểm quá trình thấp trước thi) **mất nguồn dữ liệu** → bỏ hoặc thay. Luồng `PROCESS_ONLY`, `processPublishedAt`, lỗi `RESULT_ALREADY_FINAL` trở thành thừa.
- `COMB-01` mất nhóm "học lực" giữa kỳ → còn 2 nhóm (điểm danh, LMS).
- Điểm rủi ro: nhóm học lực gần như luôn `MISSING` suốt học kỳ → mọi sinh viên `PARTIAL` cả kỳ (vô nghĩa). **Đề xuất:** khi học kỳ hiện tại chưa có kết quả, nhóm học lực dùng **ĐTB học kỳ trước** (đã công bố, không rò rỉ thời gian).
- Học phần khóa điểm rải rác (môn 8 tuần, 15 tuần) → luật cấp học kỳ (`ACA-02`, `ACA-03`) phải biết khi nào "đủ kết quả học kỳ".

### Đối chiếu luật học lực với Điều 11 quy chế 336

| Điều 11 | Luật hiện tại | Đánh giá |
|---|---|---|
| a) TC không đạt trong HK > 50% TC đăng ký | `ACA-02`: đếm số MÔN rớt (1 → Cao, ≥2 → Rất cao) | Lệch: quy chế tính theo TÍN CHỈ và tỷ lệ |
| a) TC nợ đọng từ đầu khóa > 24 | Không có | Thiếu — cần lịch sử toàn khóa |
| b) ĐTB HK < 0,8 (HK đầu khóa), < 1,0 (HK sau) | `ACA-03`: ĐTB < 2,0 → Cao | Ngưỡng 2,0 là cảnh báo SỚM (hợp lý), nhưng chưa có mức "chạm ngưỡng quy chế" |
| c) ĐTB tích lũy < 1,2/1,4/1,6/1,8 theo năm | Không có | Thiếu — cần lịch sử + "trình độ năm thứ" |
| Buộc thôi học: 3 lần cảnh báo liên tiếp | Không có | Ngoài phạm vi (quyết định hành chính, của SIS) — chỉ có thể nhắc "đã có N học kỳ liên tiếp chạm ngưỡng" |

### Đề xuất bộ luật học lực mới

- **ACA-01 — Không đạt học phần** (`PER_COURSE`, chạy ngay khi học phần khóa điểm, không chờ hết kỳ): điểm F → `HIGH`; lý do ghi rõ "không được dự thi" / "vắng thi" / "điểm F". Cảnh báo đến sớm hơn vài tuần so với chờ cuối kỳ.
- **ACA-02 — Tín chỉ không đạt trong học kỳ** (`PER_STUDENT`): tỷ lệ TC không đạt / TC đã có kết quả > 50% → `CRITICAL` ("chạm ngưỡng cảnh báo học tập Điều 11a"); ≥ 25% → `HIGH` (sớm). Ngưỡng cấu hình được.
- **ACA-03 — ĐTB học kỳ thấp** (`PER_STUDENT`): < 2,0 → `HIGH` (sớm, như cũ); < 1,0 (học kỳ đầu khóa < 0,8) → `CRITICAL` (Điều 11b).
- Chỉ chạy ACA-02/03 khi **mọi học phần** của sinh viên trong học kỳ đã có kết quả (hoặc đã rút); chưa đủ → không xét, hiện "chưa đủ kết quả học kỳ".
- (Tùy chọn) **ACA-04 — Tích lũy**: ĐTB tích lũy theo năm + nợ đọng > 24 TC. Chỉ làm khi nạp được bảng điểm các học kỳ trước.
- Chỉ xét **học kỳ chính** (Điều 11 ghi "cuối mỗi học kỳ chính") → `Term` cần cờ học kỳ chính/hè.

---

## 2. LMS — 2 loại bài

### 2a. Bài trắc nghiệm (Moodle Quiz)

Trường hiện có: mã bài, tên, lần làm, bắt đầu, nộp, thời lượng, điểm, điểm tối đa, trạng thái — **đủ cho cảnh báo theo điểm**. Đề xuất của bạn:

- Thêm `so_cau_dung`, `tong_so_cau` — **đồng ý, cột tùy chọn, chỉ để hiển thị** (cảnh báo vẫn theo `điểm / điểm tối đa`). Nếu file Moodle có cột `Q.1 /1,00`, `Q.2`… thì tự đếm câu đạt điểm tối đa.
- File xuất Moodle **không có mã học phần, thường không có mã bài và số lần làm** → mẫu file có cột `ma_lop_hoc_phan`, `ma_bai`, `ten_bai` (mục 6b); lần làm trống thì suy theo thứ tự thời điểm bắt đầu.
- Nếu file liệt kê **cả sinh viên chưa làm** (Moodle cho chọn "tất cả người dùng") → biết chắc ai bỏ bài, bỏ được giới hạn "chỉ bắt được bài đa số lớp đã làm" của `LMS-01`.

### 2b. Bài thực hành nộp file (Moodle Assignment, ảnh 4)

Ảnh 4 có: ID number (= MSSV), Email, Trạng thái ("Submitted for grading"), Grade (có thể trống), Last modified (submission). **Không có hạn nộp** trong file.

Đồng ý với hướng "chỉ dựa trạng thái nộp, bỏ điểm". Chuẩn hóa 4 trạng thái:

| Trạng thái chuẩn | Ý nghĩa |
|---|---|
| `ON_TIME` Đã nộp | Nộp trước hạn |
| `LATE` Nộp trễ | Nộp sau hạn |
| `NOT_YET` Chưa nộp | Chưa nộp, CHƯA quá hạn → không phải tín hiệu |
| `MISSING` Không nộp | Chưa nộp, ĐÃ quá hạn |

Để phân biệt `NOT_YET`/`MISSING` và đúng hạn/trễ cần **hạn nộp**: cột `han_nop` trong file (đã chốt).

Luật đề xuất:

- **LMS-03 — Không nộp bài thực hành** (`PER_COURSE`): 1 bài `MISSING` → `MEDIUM`; ≥ 2 → `HIGH`.
- **LMS-04 — Nộp trễ nhiều** (`PER_COURSE`): ≥ 2 bài `LATE` → `LOW` (chỉ trong ứng dụng).
- "Không nộp bài nhiều môn": không cần luật riêng — cảnh báo đã gộp 1 hồ sơ/sinh viên/học kỳ, hiện đủ các môn; muốn nâng mức thì `COMB-01` xét "≥ 2 học phần có bỏ bài" (xem mục 6).
- Chống rò rỉ thời gian: trạng thái là ảnh chụp tại ngày xuất → lưu kèm `ngày chốt` như điểm danh; khi chạy lại mốc cũ dùng `thời điểm nộp` + `hạn nộp` để suy trạng thái tại mốc đó.

---

## 3. Điểm danh (ảnh 2, 3)

| Màn hình trường | Mẫu hệ thống | Nhận xét |
|---|---|---|
| Vắng có phép (tiết), Vắng không phép (tiết) | `vang_co_phep`, `vang_khong_phep` (buổi) | **[LỆCH]** đơn vị tiết |
| Tổng số tiết (45) | `tong_buoi_ke_hoach` (tùy chọn) | Đây chính là mẫu số đúng quy chế → đưa thành **bắt buộc** |
| Tỷ lệ vắng (%) | — | Trường đã tính sẵn = (CP+KP)/tổng tiết → dùng đối chiếu |
| Không có | `tong_buoi` (đã học), `co_mat`, `di_tre` | **[LỆCH]** không có nguồn |
| Lớp học phần (tiêu đề) | `ma_hoc_phan` | Như mục 0.2 |
| Ngày sinh | — | Bỏ qua, không lưu |

Điều chỉnh đề xuất:

- Chuyển `AttendanceSummary` sang **tiết**: `totalPeriods` (bắt buộc), `excusedAbsence`, `unexcusedAbsence`; bỏ bắt buộc `present`, `late`, `totalSessions`. Ngày chốt: lấy ngày trên form nhập nếu file không có.
- **ATT-01**: mẫu số = tổng số tiết → khớp đúng quy chế, **xóa được giới hạn "buổi ≠ tiết"**. Không cần `minSessions` nữa (mẫu số cố định nên đầu kỳ không bị phóng đại 1/2 = 50%).
- **ATT-02**: "tăng ≥ 2 buổi" → "tăng ≥ X% tổng tiết trong 14 ngày" (đề xuất 10%, ≈ 4–5 tiết của môn 45 tiết) — không phụ thuộc số tiết/buổi.
- **ATT-03 (đi trễ)**: trường không có dữ liệu ("Nhập số tiết" là vắng một phần, đã cộng vào tiết vắng) → **bỏ luật**.

---

## 4. Học lại

Hệ thống **đã làm đúng hướng bạn đề xuất**: không cần cột "học lại lần mấy". Khi nạp, `Enrollment.attemptNumber` = 1 + số học kỳ trước có kết quả F của cùng (sinh viên, học phần); nạp điểm F muộn thì tự tính lại các học kỳ sau. Ví dụ: HK1 nạp điểm F môn Logic học → HK2 điểm danh có môn Logic học → hệ thống biết là lần 2 → `COMB-02` nâng mức nếu lại vắng/bỏ bài.

Ba điều kiện để chạy được với dữ liệu thật:

1. **[HỎI → có bằng chứng 2026-10-22]** Mã học phần ổn định giữa các học kỳ (mục 0.2) — mã lớp học phần `010100240802` có phải = mã học phần `0101002408` + số thứ tự lớp `02` không? Chương trình khung KTPM2311 (người dùng gửi) liệt kê mã học phần 10 số (`0101002408` Logic học, `0101000894` Cơ sở dữ liệu…) — khớp giả định; vẫn chờ xác nhận chính thức.
2. **[THIẾU]** Kết quả các học kỳ TRƯỚC khi bắt đầu dùng hệ thống: phải nạp (ít nhất các môn F), nếu không học lại ở học kỳ đầu dùng hệ thống bị bỏ sót.
3. **[HỎI]** "Qua học kỳ sau kiểm tra lại xem đã có chưa": nếu ý bạn là cảnh báo cả sinh viên **rớt mà chưa đăng ký học lại** (nợ môn) — đó là dữ liệu nợ đọng (Điều 11a, > 24 TC), đi cùng ACA-04 tùy chọn.

---

## 5. Quy trình từ đầu đến cuối — điểm chưa hợp lý

| Bước | Hiện tại | Vấn đề | Đề xuất |
|---|---|---|---|
| Nạp điểm danh | 1 file CSV nhiều học phần | Trường xuất **1 file / lớp học phần / lần** → 1 khoa vài chục file mỗi tuần | Cho chọn **nhiều file 1 lần**, tự đọc mã lớp học phần ở tiêu đề |
| Nạp LMS | 1 file nhiều bài | Moodle xuất **1 file / bài** | Như trên; học phần, bài, hạn nộp lấy từ cột trong file |
| Nạp kết quả | Giữa kỳ + cuối kỳ | Chỉ nạp khi khóa điểm | 1 lần / lớp học phần; bỏ luồng `PROCESS_ONLY` |
| Ghép 3 nguồn | Theo `ma_hoc_phan` | 3 nguồn dùng mã khác nhau / không có mã | Bảng ánh xạ "mã lớp học phần / khóa học Moodle → học phần" |
| Tín chỉ | Từ file kết quả | File không có | **[HỎI]** lấy từ đâu (danh mục học phần?) |
| Luật cấp học kỳ | Chạy mỗi lần | Kết quả đến rải rác | Chỉ chạy khi đủ kết quả học kỳ |
| Khớp sinh viên Moodle | Theo `mssv` | ID number có thể trống | Khớp `mssv`, trống thì khớp **email đã lưu** của sinh viên (không suy MSSV từ email) |
| MSSV | — | Có cả dạng 11 ký tự (`KTPM2411056`) và 12 ký tự (`KTPM26110070`) | Kiểm tra mọi chỗ không giả định độ dài |
| Ngày giờ Moodle | `YYYY-MM-DD HH:mm`… | Moodle ghi "Thursday, 15 October 2026, 3:32 PM" (hoặc tiếng Việt) | Bổ sung dạng này vào bộ đọc |

---

## 6. Bộ luật mới — 12 luật, giải thích dễ hiểu

Nguyên tắc chung (giữ nguyên): mọi con số dưới đây là **mặc định**, Admin đổi được ở "Cấu hình luật"; mỗi luật đúng → 1 "dấu hiệu"; mọi dấu hiệu của 1 sinh viên trong 1 học kỳ gộp thành **1 cảnh báo**, mức cảnh báo = mức cao nhất. 4 mức: Thấp (chỉ báo trong ứng dụng) · Trung bình · Cao · Rất cao (gửi email cho CVHT).

**Thiếu dữ liệu ≠ không có rủi ro**: luật nào thiếu dữ liệu cần thiết thì **không xét** và ghi rõ "chưa đủ dữ liệu", không bao giờ hiểu là "sinh viên ổn".

### Nhóm 1 — Điểm danh (chạy mỗi lần nạp file điểm danh)

| Luật | Khi nào cảnh báo | Mức | Ví dụ (môn 45 tiết) | Vì sao |
|---|---|---|---|---|
| **ATT-01** Vắng gần ngưỡng cấm thi | Tỷ lệ vắng = (tiết vắng có phép + không phép) ÷ tổng số tiết của học phần | ≥ 10% Trung bình · ≥ 15% Cao · **> 20% Rất cao** | Vắng 5 tiết (11%) → TB; 7 tiết (16%) → Cao; 9 tiết (đúng 20%) → Cao; 10 tiết (22%) → Rất cao "đã vượt ngưỡng cấm thi" | Quy chế: vắng quá 20% số tiết bị cấm thi |
| **ATT-02** Vắng tăng nhanh | Vắng KHÔNG phép tăng ≥ 10% tổng số tiết giữa 2 lần chốt cách nhau ≤ 14 ngày | Cao | Ngày 01/10 vắng KP 3 tiết, ngày 10/10 vắng KP 9 tiết → tăng 6 tiết (13%) → Cao | Bắt sớm sinh viên đột ngột bỏ học, trước khi chạm 20% |

Bỏ **ATT-03 (đi trễ)**: hệ thống điểm danh của trường không có số liệu đi trễ.

### Nhóm 2 — LMS (chạy mỗi lần nạp file LMS)

| Luật | Khi nào cảnh báo | Mức | Ví dụ | Vì sao |
|---|---|---|---|---|
| **LMS-01** Bỏ bài trắc nghiệm | Bài trắc nghiệm đã **quá hạn** (`han_nop`) mà sinh viên không có lượt nộp | 1 bài TB · ≥ 2 bài Cao | Môn CSDL có 3 bài đã hết hạn, SV không làm bài 2 và 3 → Cao | Không làm bài = dấu hiệu bỏ môn |
| **LMS-02** Điểm trắc nghiệm thấp | 2 bài trắc nghiệm gần nhất đã làm đều < 50% điểm tối đa (lấy lượt cao nhất) | TB | Bài 1: 4/10, bài 2: 6/20 (=3/10) → TB | Hổng kiến thức kéo dài, trước kỳ thi |
| **LMS-03** Không nộp bài thực hành | Bài thực hành đã **quá hạn** mà trạng thái vẫn "Chưa nộp" | 1 bài TB · ≥ 2 bài Cao | 2 bài thực hành quá hạn chưa nộp → Cao | Chỉ dựa trạng thái nộp vì giảng viên có thể chưa chấm điểm |
| **LMS-04** Nộp trễ nhiều | ≥ 2 bài thực hành "Nộp trễ" trong 1 học phần | Thấp | 2 bài nộp trễ → Thấp (không email) | Nhắc nhẹ, chưa đáng báo động |

"Chưa nộp" mà **chưa đến hạn** → bình thường, không cảnh báo. Bài trắc nghiệm không có `han_nop` → dùng cách cũ: coi là "đến hạn" khi ≥ 50% lớp đã làm và đã qua 3 ngày.

### Nhóm 3 — Kết quả học tập (chạy khi nạp bảng điểm học phần đã khóa)

| Luật | Khi nào cảnh báo | Mức | Ví dụ | Vì sao |
|---|---|---|---|---|
| **ACA-01** Không đạt học phần | Học phần có điểm chữ F (kể cả "không được dự thi", "vắng thi") | Cao | Logic học: F, lý do "không được dự thi" → Cao | Báo ngay khi học phần khóa điểm, không chờ hết học kỳ |
| **ACA-02** Rớt nhiều tín chỉ trong học kỳ | Tín chỉ F ÷ tổng tín chỉ đã có kết quả của học kỳ | ≥ 25% Cao · **> 50% Rất cao** | Học 18 TC, rớt 6 TC (33%) → Cao; rớt 10 TC (56%) → Rất cao "chạm ngưỡng cảnh báo học tập Điều 11a" | Quy chế Điều 11a |
| **ACA-03** ĐTB học kỳ thấp | ĐTB hệ 4 của học kỳ (A+ 4 · **A 3,8** · B+ 3,5 · B 3 · C+ 2,5 · C 2 · D+ 1,5 · D 1 · F 0) | < 2,0 Cao · **< 1,0 Rất cao** (học kỳ đầu khóa: < 0,8) | 3 môn 3 TC: B, D, F → (9 + 3 + 0) ÷ 9 = 1,33 → Cao | 2,0 là mức báo sớm; 1,0 / 0,8 là ngưỡng Điều 11b |
| **ACA-04** Sa sút qua các học kỳ | So với **học kỳ liền trước** của sinh viên: (a) ĐTB giảm ≥ 1,0 → TB; (b) học kỳ trước đã ở mức Rất cao của ACA-02/03 và học kỳ này lại Rất cao → Rất cao | TB / Rất cao | HK1: 2,8 → HK2: 1,6 → giảm 1,2 → TB. HK1 và HK2 đều ĐTB < 1,0 → Rất cao "2 học kỳ liên tiếp chạm ngưỡng; quy chế: 3 lần liên tiếp bị buộc thôi học" | Phát hiện xu hướng xấu dần, không chỉ 1 học kỳ |

ACA-02, ACA-03, ACA-04 chỉ chạy khi **mọi học phần của sinh viên trong học kỳ đã có kết quả** — vì bảng điểm các môn về rải rác. ACA-04: **học kỳ trước của sinh viên không có dữ liệu → không xét**.

> **"Nạp kết quả học kỳ trước" nghĩa là gì?** Hệ thống chỉ biết những gì đã nạp vào. Nếu bắt đầu dùng từ HK1 2026–2027 thì hệ thống không biết sinh viên học gì ở HK3 2025–2026. Muốn ACA-04 và COMB-02 (học lại) chạy được ngay từ học kỳ đầu dùng hệ thống: Admin tạo học kỳ cũ rồi nạp bảng điểm cũ (chỉ cần file kết quả, không cần điểm danh/LMS). Không nạp cũng không sao: 2 luật này tự bỏ qua, và từ học kỳ sau dữ liệu có sẵn.

### Nhóm 4 — Kết hợp

| Luật | Khi nào cảnh báo | Mức | Ví dụ | Vì sao |
|---|---|---|---|---|
| **COMB-01** Nhiều nguồn cùng xấu | Trong CÙNG 1 học phần, ≥ 2 trong 3 nhóm có dấu hiệu ≥ TB: điểm danh (ATT-01/02) · trắc nghiệm (LMS-01/02) · thực hành (LMS-03) | Rất cao | Môn CTDL: vắng 11% (TB) + bỏ 1 bài thực hành (TB) → Rất cao | Nhiều nguồn cùng xấu thì gần như chắc chắn có vấn đề |
| **COMB-02** Học lại vẫn sa sút | Học phần đang học lại (đã F ở học kỳ trước) + có dấu hiệu điểm danh/LMS ≥ TB | Tăng 1 bậc (tối đa Rất cao) | Học lại Logic học, vắng 11% (TB) → nâng lên Cao | Rớt lần 2 hậu quả nặng hơn |

"Học lại" hệ thống tự đếm: điểm F của học phần ở học kỳ trước đã nạp → học kỳ sau gặp lại cùng mã học phần thì biết là lần 2.

### So với bộ luật cũ

| Bỏ | Thêm | Sửa |
|---|---|---|
| ATT-03 đi trễ; ACA-01 cũ (điểm quá trình thấp) | LMS-03, LMS-04, ACA-04 | ATT-01/02 sang tiết; ACA-01 = không đạt học phần; ACA-02 theo % tín chỉ; ACA-03 thêm mức quy chế, A = 3,8; COMB-01 tách LMS thành 2 nhóm |

Tổng **12 luật** (tài liệu, báo cáo đang ghi "10 luật" → phải sửa).

### Điểm rủi ro (chỉ để sắp xếp, không tạo cảnh báo) — đề xuất, chưa chốt

Giữ 3 nhóm điểm danh 0,4 / LMS 0,3 / học lực 0,3. Vì kết quả học tập chỉ có khi học phần khóa điểm, giữa học kỳ nhóm học lực dùng **ĐTB học kỳ liền trước** (không có thì bỏ nhóm này khỏi công thức như hiện nay).

---

## 6b. Mẫu file đề xuất (theo cột trong ảnh hệ thống trường)

Tiêu đề 1 dòng, tiếng Việt không dấu. `*` = tùy chọn. `ho_dem`, `ten` chỉ để đối chiếu, không lưu.

| File | Cột |
|---|---|
| Sinh viên | `mssv, ho_ten, email, ma_lop_sinh_hoat, trang_thai_hoc_vu` (không đổi — khóa lấy từ lớp sinh hoạt) |
| Điểm danh | `mssv, ho_dem*, ten*, ma_lop_hoc_phan, ma_hoc_phan*, ten_hoc_phan, ngay_chot, tong_so_tiet, vang_co_phep, vang_khong_phep, ty_le_vang*` (đơn vị tiết; `ty_le_vang` dùng đối chiếu) |
| Bài trắc nghiệm | `mssv, ho_dem*, ten*, ma_lop_hoc_phan, ma_bai, ten_bai, han_nop*, lan_lam*, thoi_diem_bat_dau, thoi_diem_nop*, thoi_gian_lam_phut*, diem*, diem_toi_da*, so_cau_dung*, tong_so_cau*, trang_thai` (`trang_thai`: Đã nộp / Đang làm / Chưa làm) |
| Bài thực hành | `mssv, ho_dem*, ten*, ma_lop_hoc_phan, ma_bai, ten_bai, han_nop, trang_thai_nop, thoi_diem_nop*` (`trang_thai_nop`: Đã nộp / Nộp trễ / Chưa nộp) |
| Kết quả học phần | `mssv, ho_dem*, ten*, ma_lop_hoc_phan, ma_hoc_phan*, ten_hoc_phan, so_tin_chi, diem_thuong_xuyen*, duoc_du_thi*, diem_cuoi_ky*, vang_thi*, thang_diem_4*, diem_chu, ngay_cong_bo*` |

- `ma_hoc_phan` trống → tự lấy `ma_lop_hoc_phan` bỏ 2 số cuối, hiện ở màn xem trước.
- `so_tin_chi` bắt buộc: file trường không có → Admin điền theo chương trình đào tạo.
- `thang_diem_4` lệch quy đổi từ `diem_chu` → cảnh báo nhập liệu (không chặn).
- `duoc_du_thi = Không` hoặc `vang_thi = Có` → ghi vào lý do của ACA-01.

---

## 7. Giao diện — đề xuất trực quan hơn

Quan sát từ ảnh chụp hiện tại:

1. **[SAI] Trang sinh viên ghi "Ổn định — Bạn đang theo kịp học kỳ" trong khi chính bảng bên dưới ghi vắng 23,3% (vượt ngưỡng cấm thi)** — vì sinh viên chỉ thấy cảnh báo sau khi CVHT xác nhận. Đề xuất: bỏ nhãn "Ổn định"; mỗi học phần có **thanh tiến độ vắng so với vạch 20%** (xanh/vàng/đỏ) — số liệu thật, không phải cảnh báo nên không vi phạm quyết định "chỉ thấy cảnh báo sau xác nhận".
2. **Danh sách CVHT**: cột "Vì sao" chỉ ghi "2 nguyên nhân: điểm danh" → thay bằng **câu nguyên nhân nặng nhất** ("Vắng 23% môn CNPM — vượt ngưỡng cấm thi"); thêm ô tìm kiếm, lọc lớp/mức/nguồn; thẻ đếm Cần xử lý / Đang theo dõi / Đã xong; nhãn "quá 7 ngày chưa xử lý".
3. **Hồ sơ sinh viên** (Admin, CVHT): thêm **dòng thời gian** (các lần nạp, cảnh báo, can thiệp); **biểu đồ tỷ lệ vắng theo ngày chốt** từng học phần; ĐTB các học kỳ; mỗi học phần hiện biểu tượng 3 nguồn (điểm danh / trắc nghiệm / thực hành) màu theo mức.
4. **Tổng quan Admin**: thay "Sĩ số theo lớp" (ít giá trị) bằng: cảnh báo theo **nguồn**, theo **lớp/khoa**, **xu hướng theo tuần**, **top học phần nhiều cảnh báo**, tỷ lệ CVHT đã xử lý.
5. **Nhập dữ liệu**: kéo thả nhiều file; xem trước nhận diện tự động "file điểm danh lớp học phần X, 84 sinh viên, ngày chốt Y"; bảng **lịch nạp theo tuần** (học phần nào tuần này chưa có điểm danh).
6. **Ma trận lớp × học phần** cho CVHT: hàng = sinh viên, cột = học phần, ô màu theo mức — nhìn 1 màn biết cả lớp.

---

## 8. Câu hỏi đã trả lời (2026-10-18)

| Câu hỏi | Trả lời |
|---|---|
| File xuất thật | Không có, chỉ ảnh → mẫu theo ảnh (mục 6b) |
| Mã lớp học phần ↔ mã học phần | "Hình như đúng" bỏ 2 số cuối → giả định, cho phép điền riêng |
| Điểm chữ đặc biệt | Không cần |
| Học kỳ hè | Không còn; 1 năm = 3 học kỳ chính |
| Học kỳ đầu khóa | Cột `khoa` ở file sinh viên |
| Số tín chỉ | Chưa trả lời → mẫu bắt buộc `so_tin_chi`, Admin điền |

---

## 9. Review trước khi code (kiểu hội đồng) — 2026-10-18

| # | Câu hỏi hội đồng sẽ hỏi | Rủi ro | Cách xử lý |
|---|---|---|---|
| 1 | Đổi điểm danh sang tiết, đổi nghĩa ACA-01 — dữ liệu và lịch sử phiên bản luật cũ thì sao? | Phiên bản cũ của ACA-01 có `condition` khác hẳn, form cấu hình đọc lỗi | **Chốt:** sao lưu `pg_dump` → làm sạch dữ liệu học tập, cảnh báo, luật → seed 12 luật mới. Giữ tài khoản, khoa, lớp, sinh viên, học kỳ. Hỏi xác nhận lần cuối trước khi xóa |
| 2 | 1 môn mãi không có bảng điểm thì ACA-02/03/04 có bao giờ chạy? | Sinh viên rớt nhiều không bao giờ bị xét | **Chốt:** "Chốt học kỳ" hiện danh sách sinh viên thiếu kết quả → Admin xác nhận → chạy đánh giá lần cuối, tính trên các môn đã có, lý do ghi "thiếu N môn" → rồi mới chốt |
| 3 | Giữa kỳ chưa có điểm, điểm rủi ro nhóm học lực lấy gì? | Mọi sinh viên `PARTIAL` cả kỳ | **Chốt:** ĐTB học kỳ trước (≥ 2,0 → 0; 1,0 → 0,5; 0 → 1); không có → bỏ nhóm |
| 4 | Trường xuất 1 file / lớp học phần mà hệ thống chỉ cho 1 lô chờ / loại / học kỳ? | Admin nạp từng file, mỗi file 2 bước | **Chốt:** nạp nhiều file vào 1 lô ở Phase 8b |
| 5 | ACA-04 "học kỳ trước đã chạm ngưỡng" lấy từ đâu? | Nếu đọc từ cảnh báo đã lưu thì phụ thuộc việc HK trước có chạy đánh giá không | Tính lại từ dữ liệu kết quả HK trước (hàm thuần, như ACA-02/03) — không đọc cảnh báo cũ |
| 6 | "Học kỳ liền trước" khi sinh viên bảo lưu 1 kỳ? | So sánh nhầm 2 kỳ cách xa | Liền trước = học kỳ ngay trước theo `startDate` trong hệ thống; sinh viên không có kết quả ở kỳ đó → không xét. Ghi vào giới hạn |
| 7 | Hạn nộp lặp ở mọi dòng của cùng 1 bài — dòng lệch nhau? Giảng viên gia hạn? | Mỗi dòng 1 hạn khác nhau, luật không biết theo hạn nào | Bảng mới `LmsActivity` (học phần × học kỳ × mã bài: loại QUIZ/ASSIGNMENT, tên, hạn nộp) — 1 hạn / bài. Hạn lệch trong 1 file → lỗi dòng; nạp lại với hạn mới → cập nhật + cảnh báo "đã đổi hạn nộp" |
| 8 | Biết "nộp trễ" tại mốc quá khứ thế nào (chống rò rỉ thời gian)? | Trạng thái trong file là trạng thái lúc xuất | `thoi_diem_nop` bắt buộc khi Đã nộp / Nộp trễ. Tại mốc `asOf`: nộp lúc ≤ `asOf` → đã nộp (trễ nếu sau hạn); chưa nộp và hạn < `asOf` → không nộp; còn lại → chưa đến hạn |
| 9 | Mã học phần suy từ mã lớp học phần sai thì sao? | Học lại (COMB-02) âm thầm không phát hiện được | Màn xem trước hiện cột "mã học phần (tự suy)"; cho điền `ma_hoc_phan` riêng; ghi vào giới hạn |
| 10 | Ngưỡng 25% (ACA-02), giảm 1,0 (ACA-04), 10% (ATT-02) lấy từ đâu? | Hội đồng hỏi căn cứ | Ghi rõ trong `08`: ngưỡng quy chế (20%, 50%, 1,0/0,8) vs ngưỡng **báo sớm do nhóm đề xuất, chưa hiệu chỉnh bằng dữ liệu thật**, Admin đổi được |
| 11 | Hệ thống có "cảnh báo học vụ" thay phòng đào tạo không? | Vượt ranh giới phạm vi | Lời văn: "chạm ngưỡng cảnh báo học tập theo Điều 11 — tham khảo"; không ghi `officialAcademicStatus` (bất biến cũ) |
| 12 | Tên trong file khác tên hệ thống — chặn hay cho qua? | Chặn thì phiền khi khác dấu/viết tắt | So sánh sau khi bỏ dấu, chữ thường, gộp khoảng trắng; lệch → cảnh báo (không chặn) |
| 13 | Không có file thật, chỉ ảnh — nhập file trường được không? | Admin phải chép dữ liệu sang mẫu | Ghi giới hạn; bộ đọc tự tìm dòng tiêu đề trong 10 dòng đầu (dán cả vùng bảng từ file trường vẫn đọc được nếu tiêu đề 1 dòng) |
| 14 | Toàn bộ dữ liệu demo, 8 kịch bản, ảnh chụp, báo cáo ghi "10 luật"? | Lệch tài liệu khi bảo vệ | Sửa `KET_QUA_MONG_DOI.md` + dữ liệu demo TRƯỚC, rồi code (`02`); cập nhật kịch bản, ảnh; báo cáo Word người dùng tự sửa theo danh sách thay đổi |
