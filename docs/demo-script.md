# Kịch bản demo bảo vệ đồ án

**Từ 2026-11-08 kịch bản chính lấy Moodle làm trọng tâm** (người dùng chốt): dữ liệu điểm danh / trắc nghiệm / thực hành đi từ Moodle 5.3 sang EWARS gần thời gian thực → tự đánh giá → chuông cố vấn. Kết quả học phần + luật học lực dùng bộ nạp file v3. Lời nói chi tiết: `docs/bao-cao/kich-ban-thuyet-trinh.md` (M1–M9). Số liệu Moodle khớp `docs/demo-data/moodle/KET_QUA_MONG_DOI.md` (`tests/integration/moodle-sync-acceptance.test.ts`, `moodle-auto-acceptance.test.ts`); số liệu nạp file khớp `docs/demo-data/KET_QUA_MONG_DOI.md`.

## A. Kịch bản chính — Moodle (~14 phút)

### Chuẩn bị (sáng hôm bảo vệ, ≥ 30 phút trước)

1. `.env`: `MOODLE_EVENTS_BASE_URL=http://app:3000` (app chạy Docker).
2. Dựng (build lại image theo code mới nhất):

```bash
docker compose --profile dev --profile moodle up -d --build
```

3. Bộ nạp file v3 (nạp sẵn 7 lô, chưa chạy đánh giá):

```bash
npm run demo:reset -- --yes
```

4. Moodle demo theo ngày chốt hôm qua + cấu hình plugin `local_ewars`:

```bash
npm run moodle:setup -- --reset
```

5. Admin → **Học kỳ** → **Học kỳ 1, 2026–2027** → **Đặt làm hiện tại**.
6. `docker ps` chỉ có 1 `ewars-app-1` + 1 `ewars-worker-1`; KHÔNG chạy `npm run dev` / worker ở máy cùng lúc (bẫy: container cũ tự bật lại → app cũ trả 404 cho chuông Moodle, worker cũ tranh job).
7. Diễn tập trọn M6 trước ít nhất 1 ngày, xong làm lại bước 3–5.
8. Ngày chốt (hôm qua) phải trong **05/11–20/12/2026** (giới hạn dữ liệu Moodle demo).

Cửa sổ: Chrome = Admin (`/admin/moodle`) · Edge = GV001 · Chrome ẩn danh = SV `KTPM2411903` · Firefox = Moodle `gv.moodle` (khóa Mạng máy tính → Điểm danh) · tab MailHog · terminal (lệnh dự phòng).

### Các bước

| # | Phút | Cửa sổ → Màn hình | Thao tác | Phải thấy / nói gì |
|---|---|---|---|---|
| M1 | 0:00 | Moodle `gv.moodle` → Mạng máy tính → **Điểm danh** | Chỉ 15 buổi, ký hiệu P/L/E/A, 3 trắc nghiệm, 3 thực hành | Course ID number = mã lớp học phần `010100089201`; dữ liệu đang nằm ở Moodle |
| M2 | 1:30 | Admin → **Kết nối Moodle** → chip **Học kỳ 1, 2026–2027** | **Bật đồng bộ** 2 khóa → **Đồng bộ ngay** → 3 lô → mở lô Điểm danh (tổng số tiết 60) → **Xác nhận nạp cả 3** | Đã kết nối, 11 hàm chỉ đọc; ~480 (tăng theo số buổi) · **121** · **120** dòng, **0 lỗi**; 15 buổi × 200 phút ÷ 50 = 60 tiết |
| M3 | 4:00 | Admin → **Chạy đánh giá** | Học kỳ 1, 2026–2027, mốc trống → Chạy → mở **chuông** | **12 dấu hiệu, 9 cảnh báo**; chuông "Admin chạy đánh giá · Đánh giá xong 20 sinh viên · 9 cảnh báo mới" |
| M4 | 5:00 | Edge → **GV001** → chuông → **Cảnh báo sớm** | `KTPM2411903` → **Xác nhận đã xem** → **Ghi can thiệp**. `KTPM2411906` → Xác nhận → Ghi can thiệp → **Đánh dấu đã giải quyết** | Chuông "Lớp KTPM2411: 9 cảnh báo mới"; 903 MMT 16/60 = **26,7%** Rất cao; 906 có phép 8/60 = 13,3% Trung bình |
| M5 | 7:00 | Ẩn danh → **KTPM2411903** (tải lại); Admin → Kết nối Moodle | **Bật Tự động** 2 khóa | SV thấy cảnh báo vì CVHT đã xác nhận. Khung "Tự động: 2 khóa học" |
| M6 ★ | 8:00 | Firefox (Moodle) cạnh Edge (GV001, Cảnh báo sớm) | Moodle: Điểm danh → buổi gần nhất đã điểm danh → **Take attendance** → `KTPM2411906` = **A** → **Save attendance**; đọc giờ | ~30 giây–2 phút: toast + chuông "**Moodle: Điểm danh — Mạng máy tính vừa cập nhật · Lớp KTPM2411: 1 mở lại**" → **Tải lại** → 906 **Mở lại**, mức **Cao** (12/60 = đúng 20%); MailHog có email |
| M7 | 10:30 | Admin → Kết nối Moodle; **Nhập dữ liệu** | Chỉ danh sách lần đồng bộ (nguồn kích hoạt), nhãn Moodle ở lịch sử nạp | Lỗi > 10% → "Cần Admin xem"; hết hạn nộp → hạn + 5 phút; app điện thoại → dò 10 phút; rời khóa → liệt kê, không tự xóa; lô Moodle không hoàn tác |
| M8 | 11:30 | Admin → **Học kỳ** → Học kỳ 1, 2025–2026 → **Chốt học kỳ** | Hộp thoại: 2 SV thiếu kết quả → mốc **2025-12-31** → **Chạy đánh giá cuối và chốt** → Cảnh báo sớm (học kỳ 2025–2026) → `HTTT2411908`, `KTPM2411918` | 908: ĐTB 0,75, rớt 62,5%, 2 học kỳ liền → Rất cao (`ACA-04`); 918: ĐTB **1,93** vì A = 3,8. KHÔNG đọc tổng số cảnh báo (khác bản nạp file vì bỏ 2 lần chạy giữa kỳ) |
| M9 | 13:30 | Admin → **Nhật ký hệ thống** | Lọc "Đồng bộ Moodle tự động" | Ghi dưới tên "Đồng bộ Moodle (hệ thống)"; không sửa / xóa |

**Trễ giờ → bỏ:** màn xem trước lô (M2) → M7 còn 1 câu → KTPM2411918 (M8) → SV xem (M5). **Không bỏ M6.**

**M6 chậm > 2 phút:** Admin → Kết nối Moodle → **Đồng bộ ngay** (khóa Tự động nạp luôn). **Không thao tác được Moodle:** `docker compose exec -u www-data moodle php /var/www/html/ewars-cli/ewars_simulate.php --course=010100089201 --absent=KTPM2411906` (Git Bash thêm `MSYS_NO_PATHCONV=1`).

### Kịch bản phụ Moodle

**G. Hết hạn nộp tự đánh giá (cần chờ ~8 phút — làm ngay đầu buổi nếu hội đồng muốn xem).** `… ewars_simulate.php --course=010100089201 --due-in=3 --assign="Thực hành 3"` (hoặc giảng viên sửa hạn trên Moodle) → ≤ 1 phút EWARS biết hạn mới → hạn + 5 phút: lần đồng bộ "Hết hạn nộp bài" + đánh giá → 18 sinh viên chưa nộp có `LMS-03` (số cảnh báo tăng mạnh — làm sau M6). Trả lại: `npm run moodle:setup -- --reset`.

**H. Sinh viên làm / nộp bài.** Đăng nhập Moodle bằng MSSV viết thường (VD `ktpm2411907`, mật khẩu `MOODLE_DEMO_PASSWORD`) → nộp Thực hành 3 (chưa tới hạn) → ~1 phút chuông "Moodle: Bài thực hành LMS — Mạng máy tính vừa cập nhật · Lớp KTPM2411: không có thay đổi cảnh báo" (dữ liệu cập nhật nhưng không đổi cảnh báo).

**I. Sinh viên rời khóa.** Moodle (admin) → Participants → bỏ ghi danh 1 sinh viên → ≤ 10 phút (dò định kỳ; hoặc Đồng bộ ngay) → Kết nối Moodle hiện "1 sinh viên đã rời khóa trên Moodle" → hướng dẫn đánh dấu Rút học phần.

**J. Chạy tay ↔ Tự động.** **Về Chạy tay** 1 khóa → thao tác trên Moodle → không tự nạp; **Đồng bộ ngay** → lô chờ **Xác nhận nạp cả 3** / **Hủy**.

---

## B. Kịch bản nạp file (bản trước — dùng khi hội đồng muốn xem nạp file / khi Moodle hỏng)

1 kịch bản (~10 phút) trên bộ dữ liệu demo v3 (`docs/demo-data/`: toàn Khoa CNTT khóa 2024 — 5 lớp × 20 sinh viên, mỗi lớp 1 chủ đề tình huống và 1 Cố vấn học tập GV001–GV005; học kỳ 1 2025–2026) + bảng "hội đồng hỏi gì → mở gì" phủ đủ 12 luật + các kịch bản thao tác phụ. Chạy trên dữ liệu MỚI dựng (`demo:reset`), KHÔNG chạy sau M8 của kịch bản Moodle (M8 đã chốt Học kỳ 1, 2025–2026).

**Giới hạn ghi khi trình bày:** mỗi lớp chỉ mô phỏng 3–4 học phần của học kỳ (≈ 7–11 tín chỉ; học kỳ thật ≈ 17); học phần 4 ngành ngoài KTPM mượn từ chương trình khung KTPM (giả định).

### Chuẩn bị (trước giờ bảo vệ ≥ 15 phút)

```bash
docker compose --profile dev up -d
```

```bash
npm run demo:reset -- --yes
```

- `demo:reset` tự sao lưu, xóa dữ liệu demo, dựng lại bộ v3 và nạp 7 lô nhiều file (1 file / lớp học phần như trường xuất). Chế độ demo **không tự chạy đánh giá** sau nạp và **không chạy lịch đêm** — cảnh báo chỉ xuất hiện khi bấm "Chạy đánh giá" lúc trình bày.
- **Mỗi vai 1 cửa sổ, đăng nhập 1 lần** (đăng nhập nhanh giới hạn 10 lần/phút):
  - Chrome thường → Quản trị viên.
  - Trình duyệt thứ hai (VD Edge) → Cố vấn học tập (đổi GV001 ↔ GV004 trong cửa sổ này).
  - Chrome ẩn danh → Sinh viên `KTPM2411903`.
  - Tab http://localhost:8025 (MailHog — email gửi Cố vấn học tập).
- **Phương án B:** video quay sẵn trọn kịch bản chính + ảnh `docs/screenshots/`. Máy trục trặc → mở video, nói như dưới.
- Kiểm tra nhanh (tùy chọn): `npm run demo:reset -- --yes --evaluate=2` → `npm run test:e2e` → `npm run demo:reset -- --yes` để trả lại trạng thái ban đầu.

### Chế độ tự nhập dữ liệu (người trình bày nạp 7 lô trước hội đồng)

```bash
npm run demo:reset -- --yes --no-data
```

Hệ thống chỉ có khoa, ngành, 5 lớp, GV001–GV005, 2 học kỳ — chưa có sinh viên. Thay **bước 2** bên dưới bằng: Admin → **Nhập dữ liệu**, nạp lần lượt 7 lô (chọn **Loại dữ liệu** + **Học kỳ** trước, rồi Ctrl + A chọn hết file trong thư mục → **Tải lên và kiểm tra** → **Xác nhận nạp**). Lời nói từng lô: lịch sử Git của `docs/bao-cao/kich-ban-thuyet-trinh.md` (bản trước 2026-11-08, mục D2).

| Lô | Thư mục | Loại dữ liệu | Học kỳ | Xem trước |
|---|---|---|---|---|
| 1 | `01_sinh_vien.csv` | Danh sách sinh viên | — | 100 dòng |
| 2 | `02_HK3_2024_ket_qua` (30 file) | Kết quả học phần | Học kỳ 3, 2024–2025 | 582 dòng |
| 3 | `03_HK1_2025_diem_danh` (32 file) | Điểm danh | Học kỳ 1, 2025–2026 | 600 dòng + 1 cảnh báo tên (Tuấn ≠ Tú) |
| 4 | `04_HK1_2025_trac_nghiem` (10 file) | Bài trắc nghiệm LMS | Học kỳ 1, 2025–2026 | 400 dòng |
| 5 | `05_HK1_2025_thuc_hanh` (9 file) | Bài thực hành LMS | Học kỳ 1, 2025–2026 | 404 dòng |
| 6 | `06_HK1_2025_ket_qua_logic_hoc` (4 file) | Kết quả học phần | Học kỳ 1, 2025–2026 | 80 dòng |
| 7 | `07_HK1_2025_ket_qua_cuoi_ky` (12 file) | Kết quả học phần | Học kỳ 1, 2025–2026 | 219 dòng |

- **Nạp đủ 7 lô rồi mới chạy đánh giá** (thứ tự đã kiểm thử → 24 → 29 → 35). Chạy mốc 10/10 khi chưa có lô 07 thì `KHDL2411919` chưa có trong học kỳ (chỉ học XSTK — không điểm danh, không LMS) → mất ví dụ "Chưa đủ dữ liệu" (xét 99 thay vì 100 sinh viên; số cảnh báo không đổi).
- Thêm ≈ 5 phút (cả demo ≈ 15 phút). Lô lỗi / quá giờ: `npm run demo:load -- --only=04,05,06,07` (các số lô chưa nạp).
- **Không mở rồi lưu file CSV bằng Excel** (mất số 0 đầu mã, ngày đổi kiểu Mỹ). Lỡ lưu: `git checkout -- docs/demo-data`.

**Thứ tự KHÔNG đảo được** — trạng thái chỉ đi 1 chiều:
1. Vòng đời KHMT (bước 7) phải làm **trước** Chạy 2 — sau Chạy 2 không quay lại được (lần chạy mốc cũ hơn chỉ gắn bằng chứng).
2. Chốt học kỳ (bước 10) là **bước cuối** — sau chốt không nạp, không chạy học kỳ đó nữa. Mọi thao tác cần học kỳ mở (nạp file lỗi, chạy thử luật, rút học phần, chạy theo học phần) làm trước.

### Các bước (10 phút)

| # | Phút | Cửa sổ → Màn hình | Thao tác | Kết quả phải thấy / nói gì |
|---|---|---|---|---|
| 1 | 0:00 | `/login` | Chỉ 2 thẻ Sinh viên (Google) / Cán bộ; link chính sách dữ liệu | 3 vai trò; sinh viên chỉ Google email trường và phải có hồ sơ; đăng nhập nhanh chỉ khi chế độ demo |
| 2 | 0:30 | Admin → **Bắt đầu** → **Nhập dữ liệu** | Mở lô **Điểm danh** (32 file): bảng từng file, 16 lớp học phần, mã học phần "tự suy"; cảnh báo tên **Tuấn ≠ Tú** (KTPM2411920). Quay lại xem bảng **Học phần nào cần nạp dữ liệu** | Nhập 2 bước, file gốc lưu MinIO, hoàn tác có điều kiện; không tự sửa tên — chỉ nhắc |
| 3 | 1:45 | **Nhập dữ liệu** | Loại Điểm danh → kéo file `docs/demo-data/minh-hoa-loi/` → 2 **dòng lỗi** (MSSV không có, ngày kiểu Mỹ) → **Hủy lô** | Ngày không rõ → từ chối, KHÔNG đoán; dòng lỗi ghi tên file + số dòng |
| 4 | 2:15 | **Chạy đánh giá** | Học kỳ 1 2025–2026, mốc **2025-10-10** → Chạy → mở kết quả; bấm **Tất cả sinh viên**, chọn lớp `KHDL2411` | **41 dấu hiệu → 24 cảnh báo** (5 lớp). Kết quả công bố 16/11 đã có trong DB nhưng không được dùng. 919 = **Chưa đủ dữ liệu**, điểm rủi ro trống |
| 5 | 3:00 | **Tổng quan** | Lọc Ngành = Kỹ thuật phần mềm → bỏ lọc | KTPM **10** cảnh báo; Admin chỉ giám sát, không xử lý |
| 6 | 3:45 | CVHT → **GV001** → **Ma trận lớp** | Bấm ô `KTPM2411903` × Hệ quản trị CSDL → **Xác nhận đã xem** → ghi can thiệp → Lưu | 903: vắng **13/60 = 21,7%** (Rất cao) + không phép tăng 3 → 11 (`ATT-02`). So sánh 904: đúng **20%** → Cao |
| 7 | 5:15 | SV ẩn danh → **KTPM2411903** | Trang "Tình hình học tập" | Thấy cảnh báo vì CVHT vừa xác nhận; thanh vắng đỏ vượt vạch; không nhận email |
| 8 | 5:45 | CVHT → **GV004** | Thấy **5** cảnh báo KHMT (không thấy KTPM). Mở `KHMT2411905` → Xác nhận → ghi can thiệp → **Đánh dấu đã giải quyết** | Phân quyền theo lớp, kiểm ở máy chủ. "Đã giải quyết" bắt buộc có can thiệp |
| 9 | 6:45 | Admin → **Chạy đánh giá** mốc **2025-11-20** | Chạy → **29** cảnh báo. CVHT GV004 → chuông → `KHMT2411905` **Mở lại**; tab MailHog có email | Logic học khóa điểm → `ACA-01` KTPM 913 (không được dự thi), 914 (vắng thi), 919. Điểm danh HQT/PTTK cũ > 14 ngày → **giữ** dấu hiệu cũ. 905: 2 bài thực hành không nộp, nặng hơn mức đã giải quyết → mở lại + thông báo. Giảm mức (KTPM 913, KHMT 906) → không thông báo |
| 10 | 7:45 | Admin → **Cấu hình luật** → ATT-01 | Thêm mức 8% "Thấp" → Lưu bản nháp → **Chạy thử luật** mốc 2025-10-10 → xem danh sách thêm → **Bỏ bản nháp** | Sửa ngưỡng = phiên bản mới, bắt buộc chạy thử; bỏ nháp để giữ số liệu |
| 11 | 8:30 | Admin → **Học kỳ** → **Chốt học kỳ** | Hộp thoại liệt kê **2 sinh viên thiếu kết quả** (KTPM2411919 · PTTK HTTT, KHDL2411903 · Phân tích CSDL lớn) → điền mốc **2025-12-31** trong hộp thoại → **Chạy đánh giá cuối và chốt** → 29 dấu hiệu, **35** cảnh báo. **Cảnh báo sớm** lọc ngành HTTT (6) → mở `HTTT2411908` | 908: ĐTB 0,75, rớt 62,5% + học kỳ trước cũng chạm quy chế → `ACA-04` Rất cao. KTPM2411918: ĐTB **1,93** vì A = 3,8 (A = 4,0 thì đúng 2,0) |
| 12 | 9:30 | Admin → **Nhật ký hệ thống** | Lọc "Xem hồ sơ sinh viên" | Mọi thao tác quan trọng ghi lại, không sửa / xóa |

**Trễ giờ → bỏ theo thứ tự:** câu so sánh 904 (bước 6) → bước 10 (chỉ nói 1 câu) → bước 5. **Không bỏ** bước 8–9 (mở lại cảnh báo) và 11 (chốt).

### Hội đồng hỏi gì → mở gì

Cột "Khi nào": trạng thái DB cần có. Sau chốt vẫn mở xem được mọi cảnh báo, chỉ không nạp / chạy thêm.

| Câu hỏi | Đăng nhập → mở | Luật | Khi nào |
|---|---|---|---|
| Vắng đúng 20% ra mức gì? | GV001 → `KTPM2411904` (HQT 12/60) → Cao; `903` (21,7%) → Rất cao | ATT-01 | Sau Chạy 1 |
| Vắng tăng nhanh? | `KTPM2411903`, `913`, `KHMT2411904`; đối chứng KTPM 904 tăng 5 < 6 tiết → không | ATT-02 | Sau Chạy 1 |
| Không làm trắc nghiệm / điểm thấp? | GV002 → `CNTT2411903` (bỏ 2 bài), `905` (4,5 và 4/10); `906` đúng 50% → không | LMS-01, LMS-02 | Sau Chạy 1 |
| Không nộp / nộp trễ bài thực hành? | `CNTT2411903`, `908`; `907` nộp trễ → Thấp, chỉ trong ứng dụng; `909` bài chưa tới hạn → chưa báo ở 10/10, báo ở 20/11 | LMS-03, LMS-04 | Sau Chạy 1 / 2 |
| Nhiều nguồn cùng xấu? | GV004 → `KHMT2411903` (3 nguồn); đối chứng `CNTT2411903`: 2 nguồn ở 2 học phần khác → không | COMB-01 | Sau Chạy 1 |
| Học lại? Mã học phần ở đâu ra? | GV003 → `HTTT2411903`, `904` (lần học 2 tự đếm); `905` học lại nhưng ổn → không | COMB-02 | Sau Chạy 1 |
| Rớt môn có báo ngay không? | `KTPM2411913` (không được dự thi), `914` (vắng thi) | ACA-01 | Sau Chạy 2 |
| Tín chỉ rớt, ĐTB, A = 3,8? | `KTPM2411915` (rớt 75%, ĐTB 0,25), `918` (1,93); `HTTT2411910` đúng 2,0 → không | ACA-02, ACA-03 | Sau chốt |
| Sa sút qua học kỳ? | GV003 → `HTTT2411906`, `907` (giảm đúng 1,0), `908` (2 học kỳ liền chạm quy chế) | ACA-04 | Sau chốt |
| Thiếu dữ liệu có bị coi là an toàn? | Kết quả đánh giá mốc 10/10: `KHDL2411918` Một phần, `919` Chưa đủ; học phần XSTK không dùng LMS | — | Sau Chạy 1 |
| Phân quyền? | GV002 dán `/advisor/students/KTPM2411903` → bị chặn | — | Luôn |
| File sai / nạp nhầm / Excel / nhiều file? | `minh-hoa-loi/` → dòng lỗi → tải file lỗi; hoàn tác lô (Playwright `tests/e2e/import-errors.spec.ts` làm đúng các bước) | — | Trước chốt (sau chốt: mở video / test) |
| Hiệu năng 5.000 SV? Sao lưu? Bảo mật? | `docs/bao-cao/02-hieu-nang.md`, `03-sao-luu-khoi-phuc.md`, `01-ra-soat-bao-mat.md` | — | Luôn |
| Trọng số điểm rủi ro lấy ở đâu? | `docs/rules/08-business-rules-catalog.md` mục RiskScore | — | Luôn |

### Kịch bản phụ — làm thì số nào đổi

**A. Vòng đời cảnh báo (KHMT, đã nằm trong kịch bản chính bước 8–9).** Không làm bước 8 thì Chạy 2 chỉ cho `KHMT2411905` tăng Trung bình → Cao (có thông báo), không có "Mở lại". `KHMT2411906`: Chạy 1 Cao → Chạy 2 Trung bình, không thông báo.

**B. Phân quyền và đổi Cố vấn học tập.** Admin → **Khoa và lớp sinh hoạt** → `KTPM2411` → **Đổi Cố vấn** sang GV002 → cảnh báo đang mở của KTPM chuyển sang GV002 (sau Chạy 2: GV002 thấy 13 + 6 = **19**; sau chốt: **22**); GV001 mất quyền ngay; nhật ký "Chuyển cảnh báo sang Cố vấn học tập khác". **Đổi lại GV001** ngay sau đó.

**C. Rút học phần (KHDL).** Chỉ làm **trước chốt**. Admin → hồ sơ `KHDL2411903` → **Đánh dấu rút học phần** Phân tích CSDL lớn → chạy lại: không còn dấu hiệu học phần đó (cảnh báo giữ, nhãn "lần đánh giá gần nhất không còn dấu hiệu"). Hệ quả: hộp thoại chốt chỉ còn **1** sinh viên thiếu kết quả — nói trước với hội đồng.

**D. Cấu hình luật / trọng số.** Chỉ **chạy thử** rồi bỏ nháp. Kích hoạt thật → số cảnh báo khác mọi con số ở trên (trả lại: tạo bản mới đúng ngưỡng cũ). Đổi trọng số `RISK-SCORE` → số sinh viên có dấu hiệu không đổi, chỉ điểm rủi ro đổi.

**E. Chạy theo 1 học phần.** Chạy đánh giá → chọn Hệ quản trị CSDL → cùng mốc đang có: chỉ xét học phần đó, **không hạ mức** cảnh báo học phần khác. Mốc mới hơn → có thể tăng mức → số khác bảng trên.

**F. Sao lưu.** `npm run backup` → `npm run restore -- backups/<file>.dump` (khôi phục vào DB thử, so số dòng).

## Sau buổi bảo vệ

```bash
npm run demo:reset -- --yes
```
