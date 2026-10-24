# Kịch bản demo bảo vệ đồ án

1 kịch bản chính (~10 phút) trên bộ dữ liệu demo v3 (`docs/demo-data/`: toàn Khoa CNTT khóa 2024 — 5 lớp × 20 sinh viên, mỗi lớp 1 chủ đề tình huống và 1 Cố vấn học tập GV001–GV005; học kỳ 1 2025–2026) + bảng "hội đồng hỏi gì → mở gì" phủ đủ 12 luật + các kịch bản thao tác phụ. Mọi con số khớp `docs/demo-data/KET_QUA_MONG_DOI.md` và được kiểm tự động (`tests/integration/demo-v3-acceptance.test.ts`). Lời nói chi tiết cho người trình bày: `docs/bao-cao/kich-ban-thuyet-trinh.md`.

**Giới hạn ghi khi trình bày:** mỗi lớp chỉ mô phỏng 3–4 học phần của học kỳ (≈ 7–11 tín chỉ; học kỳ thật ≈ 17); học phần 4 ngành ngoài KTPM mượn từ chương trình khung KTPM (giả định).

## Chuẩn bị (trước giờ bảo vệ ≥ 15 phút)

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

**Thứ tự KHÔNG đảo được** — trạng thái chỉ đi 1 chiều:
1. Vòng đời KHMT (bước 7) phải làm **trước** Chạy 2 — sau Chạy 2 không quay lại được (lần chạy mốc cũ hơn chỉ gắn bằng chứng).
2. Chốt học kỳ (bước 10) là **bước cuối** — sau chốt không nạp, không chạy học kỳ đó nữa. Mọi thao tác cần học kỳ mở (nạp file lỗi, chạy thử luật, rút học phần, chạy theo học phần) làm trước.

## Kịch bản chính (10 phút)

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

## Hội đồng hỏi gì → mở gì

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

## Kịch bản phụ — làm thì số nào đổi

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
