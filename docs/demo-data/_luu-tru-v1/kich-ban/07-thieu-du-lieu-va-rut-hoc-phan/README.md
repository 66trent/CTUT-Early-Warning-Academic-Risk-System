# Kịch bản 07 — Mức đủ dữ liệu của điểm rủi ro và rút học phần

**Chạy nhanh** (sau `npm run demo:reset -- --yes`, worker đang chạy):

```bash
npm run demo:scenario -- 7 --evaluate
```

Hoặc trình bày từng bước trên giao diện: Admin → **Nhập dữ liệu** → nạp lần lượt các file trong thư mục này (đúng loại, đúng học kỳ) → **Chạy đánh giá** với mốc dữ liệu ghi dưới đây. Kết quả được kiểm tự động bởi `tests/integration/demo-scenarios.test.ts` (sai 1 dòng là test đỏ).

**Mục đích**: điểm rủi ro chỉ tính trên nguồn có dữ liệu; thiếu dữ liệu KHÔNG bị hiểu là "rủi ro thấp". Rút học phần → bỏ qua học phần đó.

**Sinh viên**: KTPM2311701–705. **Mốc**: 2026-10-10.

| Sinh viên | Dữ liệu | Mức dữ liệu điểm rủi ro | Cảnh báo |
|---|---|---|---|
| 701 | Điểm danh (vắng 10%) + LMS + điểm quá trình (KTPM571) | **Đủ dữ liệu** | ATT-01 Trung bình |
| 702 | Chỉ điểm danh (môn không dùng LMS) | **Thiếu một phần** | — |
| 703 | Chỉ điểm quá trình | **Thiếu một phần** | — |
| 704 | Điểm danh chốt 15/09 (quá hạn) | **Chưa đủ dữ liệu** (không có điểm, không hiện là "thấp") | — |
| 705 | KTPM573 vắng 7/30 | Thiếu một phần | ATT-01 **Rất cao** |

**Rút học phần** (trình bày): Admin → **Sinh viên** → tìm `KTPM2311705` → KTPM573 → **Đánh dấu đã rút** → chạy lại đánh giá HK1_2026 mốc 2026-10-10 → cảnh báo của 705 **vẫn mở** nhưng hiện nhãn "Lần đánh giá gần nhất không còn dấu hiệu" (hệ thống không tự đóng — Cố vấn học tập quyết định). Bỏ đánh dấu được nếu nhầm; mọi thao tác ghi Nhật ký hệ thống.
