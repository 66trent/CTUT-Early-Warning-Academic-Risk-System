# Kịch bản 02 — ATT-01 — tỷ lệ vắng: các mức và ca sát ngưỡng

**Chạy nhanh** (sau `npm run demo:reset -- --yes`, worker đang chạy):

```bash
npm run demo:scenario -- 2 --evaluate
```

Hoặc trình bày từng bước trên giao diện: Admin → **Nhập dữ liệu** → nạp lần lượt các file trong thư mục này (đúng loại, đúng học kỳ) → **Chạy đánh giá** với mốc dữ liệu ghi dưới đây. Kết quả được kiểm tự động bởi `tests/integration/demo-scenarios.test.ts` (sai 1 dòng là test đỏ).

**Mục đích**: luật ATT-01 cho đúng mức ở từng ngưỡng 10% / 15% / vượt quá 20%, so sánh bằng số nguyên nên ca ĐÚNG ngưỡng ổn định.

**Sinh viên**: KTPM2311201–209. **Học phần**: KTPM521, chốt 09/10, 30 buổi kế hoạch. **Mốc**: 2026-10-10.

| Sinh viên | Vắng | Tỷ lệ | Kết quả |
|---|---|---|---|
| 201 | 2 không phép | 6,7% | Không |
| 202 | 3 | **đúng 10%** | Trung bình |
| 203 | 4 | 13,3% | Trung bình |
| 204 | 5 | 16,7% | Cao |
| 205 | 6 | **đúng 20%** | Cao (chưa VƯỢT ngưỡng cấm thi) |
| 206 | 7 | 23,3% | Rất cao — "đã vượt ngưỡng cấm thi 20%" |
| 207 | 3/3 buổi đã học | — | Không xét (mới học 3 < 4 buổi) |
| 208 | 2/16, file **thiếu** số buổi kế hoạch | 12,5% | Trung bình — lý do ghi "buổi đã học (nguồn không có số buổi kế hoạch)" |
| 209 | 2 có phép + 1 không phép | 10% | Trung bình (tính cả có phép) |

**Hội đồng có thể hỏi**: "Vì sao đúng 20% chưa phải Rất cao?" → quy chế: vắng **vượt quá** 20% mới cấm thi. "Đổi ngưỡng được không?" → Cấu hình luật → ATT-01 → bản nháp → chạy thử → kích hoạt.
