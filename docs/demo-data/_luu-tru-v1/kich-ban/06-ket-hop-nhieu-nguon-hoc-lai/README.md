# Kịch bản 06 — COMB-01 nhiều nguồn cùng xấu, COMB-02 học lại vẫn sa sút

**Chạy nhanh** (sau `npm run demo:reset -- --yes`, worker đang chạy):

```bash
npm run demo:scenario -- 6 --evaluate
```

Hoặc trình bày từng bước trên giao diện: Admin → **Nhập dữ liệu** → nạp lần lượt các file trong thư mục này (đúng loại, đúng học kỳ) → **Chạy đánh giá** với mốc dữ liệu ghi dưới đây. Kết quả được kiểm tự động bởi `tests/integration/demo-scenarios.test.ts` (sai 1 dòng là test đỏ).

**Mục đích**: luật kết hợp chạy SAU các luật cơ bản, trên cùng 1 học phần.

**Sinh viên**: KTPM2311601–604. Nạp theo thứ tự file (HK2 trước để nhận diện học lại).

| Mốc | Sinh viên | Dữ liệu | Kết quả |
|---|---|---|---|
| HK2_2025, 2026-06-15 | 603, 604 | Rớt KTPM562 | ACA-02 **Cao** |
| HK1_2026, 2026-10-10 | 601 | KTPM561: vắng 10% + điểm quá trình 4,0 | ATT-01 Trung bình + ACA-01 Cao + **COMB-01 Rất cao** |
| | 602 | KTPM561: trễ 3 (Thấp) + điểm quá trình 4,5 | ATT-03 Thấp + ACA-01 Cao — **không** COMB-01 (mức Thấp không tính) |
| | 603 | Học lại KTPM562 (lần 2) + vắng 10% | ATT-01 Trung bình + **COMB-02 Cao** (nâng 1 bậc, lý do nêu học kỳ đã rớt) |
| | 604 | Học lại KTPM562, đi học đủ | Không |

**Hội đồng có thể hỏi**: "Lần học thứ mấy tính thế nào?" → 1 + số học kỳ trước đã rớt cùng học phần (theo mốc dữ liệu), tự tính khi nạp.
