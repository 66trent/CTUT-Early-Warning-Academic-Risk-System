# Kịch bản 01 — Nhập liệu: dòng lỗi từng loại, nạp phần đúng, nạp lại, file Excel

**Chạy nhanh** (sau `npm run demo:reset -- --yes`, worker đang chạy):

```bash
npm run demo:scenario -- 1 --evaluate
```

Hoặc trình bày từng bước trên giao diện: Admin → **Nhập dữ liệu** → nạp lần lượt các file trong thư mục này (đúng loại, đúng học kỳ) → **Chạy đánh giá** với mốc dữ liệu ghi dưới đây. Kết quả được kiểm tự động bởi `tests/integration/demo-scenarios.test.ts` (sai 1 dòng là test đỏ).

**Mục đích**: cho thấy hệ thống không nạp mù — kiểm từng dòng, giữ dòng đúng, chỉ ra dòng sai và lý do, cho tải file lỗi về sửa rồi nạp lại; nhận cả CSV lẫn Excel.

**Sinh viên**: KTPM2311101–105 (lớp KTPM2311). **Học phần**: KTPM511 (HK1_2026).

| File | Loại / học kỳ | Kết quả mong đợi |
|---|---|---|
| `01_sinh_vien.csv` | Danh sách sinh viên | 5 dòng đúng; 4 dòng lỗi: email không phải `@student.ctuet.edu.vn`, trạng thái học vụ sai (Sai định dạng ×2), lớp `XXXX2399` chưa có (Lớp sinh hoạt chưa có), MSSV lặp trong file (Trùng dữ liệu) — tỷ lệ lỗi > 10% nên màn xem trước có cảnh báo |
| `02_diem_danh_co_loi.csv` | Điểm danh, HK1_2026 | 5 dòng đúng; 4 dòng lỗi: MSSV chưa có (Sinh viên chưa có trong danh sách), có mặt > tổng buổi (Ngoài phạm vi), ngày chốt 01/07 ngoài học kỳ (Không khớp học kỳ), `abc` ở cột số (Sai định dạng) |
| `03_diem_danh_da_sua.csv` | Điểm danh, HK1_2026 | Bản đã sửa 3 dòng lỗi (cách làm: "Tải file lỗi để sửa" → sửa → "Nạp lại file đã sửa") — 0 lỗi |
| `04_ket_qua_giua_ky.csv` | Kết quả học phần, HK1_2026 | Nạp dạng **Excel** (`demo:scenario` tự đổi sang `.xlsx`; trình bày tay: mở bằng Excel, Lưu thành .xlsx) — 0 lỗi |

Chạy đánh giá HK1_2026 mốc **2026-10-10** → **không** có cảnh báo nào (dữ liệu sạch: không vắng, điểm quá trình ≥ 7).

**Hội đồng có thể hỏi**: "Nạp nhầm file thì sao?" → mở lô → **Hoàn tác lô** (được khi lô chỉ thêm mới, xem `docs/rules/12`). "File 50.000 dòng?" → giới hạn 20MB / 50.000 dòng, chống zip bomb, chống chèn công thức.
