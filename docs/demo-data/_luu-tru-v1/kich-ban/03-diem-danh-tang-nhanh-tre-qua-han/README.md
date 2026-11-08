# Kịch bản 03 — ATT-02 vắng tăng nhanh, ATT-03 đi trễ, điểm danh quá hạn, số liệu bị sửa

**Chạy nhanh** (sau `npm run demo:reset -- --yes`, worker đang chạy):

```bash
npm run demo:scenario -- 3 --evaluate
```

Hoặc trình bày từng bước trên giao diện: Admin → **Nhập dữ liệu** → nạp lần lượt các file trong thư mục này (đúng loại, đúng học kỳ) → **Chạy đánh giá** với mốc dữ liệu ghi dưới đây. Kết quả được kiểm tự động bởi `tests/integration/demo-scenarios.test.ts` (sai 1 dòng là test đỏ).

**Mục đích**: luật so sánh 2 lần chốt (ATT-02), luật đi trễ (ATT-03), và cách hệ thống xử lý dữ liệu cũ / dữ liệu mâu thuẫn.

**Sinh viên**: KTPM2311301–307. **Học phần**: KTPM531. **Mốc**: 2026-10-10.

| Sinh viên | Dữ liệu | Kết quả |
|---|---|---|
| 301 | Không phép 0 (02/10) → 2 (09/10) | ATT-02 **Cao** (tăng 2 buổi trong 7 ngày) |
| 302 | 0 → 1 | Không (tăng 1) |
| 303 | 0 (18/09) → 3 (09/10) | Không ATT-02 (2 lần chốt cách 21 ngày > 14); ATT-01 **Trung bình** (10%) |
| 304 | Trễ 3 | ATT-03 **Thấp** (chỉ trong ứng dụng, không email) |
| 305 | Trễ 2 | Không |
| 306 | Không phép 3 → 1 (số liệu bị sửa giảm) | Không cảnh báo; lần chạy ghi **cảnh báo chất lượng dữ liệu** "số buổi vắng giảm" |
| 307 | Chốt 20/09, vắng 7/30 | **Không xét** (điểm danh quá hạn > 14 ngày); điểm rủi ro "Chưa đủ dữ liệu" |

**Hội đồng có thể hỏi**: "Dữ liệu cũ thì sao?" → quá 14 ngày coi là quá hạn: không kết luận, cũng không coi là đã hết vắng — dấu hiệu điểm danh cũ của cảnh báo được GIỮ (`docs/rules/08`).
