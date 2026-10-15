# Kịch bản 05 — ACA-01 điểm quá trình, ACA-02 rớt học phần, ACA-03 điểm trung bình học kỳ

**Chạy nhanh** (sau `npm run demo:reset -- --yes`, worker đang chạy):

```bash
npm run demo:scenario -- 5 --evaluate
```

Hoặc trình bày từng bước trên giao diện: Admin → **Nhập dữ liệu** → nạp lần lượt các file trong thư mục này (đúng loại, đúng học kỳ) → **Chạy đánh giá** với mốc dữ liệu ghi dưới đây. Kết quả được kiểm tự động bởi `tests/integration/demo-scenarios.test.ts` (sai 1 dòng là test đỏ).

**Mục đích**: luật học lực giữa kỳ (ACA-01) và cuối kỳ (ACA-02, ACA-03), quy đổi điểm chữ sang hệ 4 theo thang của trường.

**Sinh viên**: KTPM2311501–507. Nạp file HK2 trước, rồi HK1.

| Mốc | Sinh viên | Dữ liệu | Kết quả |
|---|---|---|---|
| HK1_2026, 2026-10-10 | 501 | Điểm quá trình 4,9 | ACA-01 **Cao** |
| | 502 | Điểm quá trình đúng 5,0 | Không (luật là < 5) |
| HK2_2025, 2026-06-15 | 503 | F, F, B | ACA-02 **Rất cao** (rớt 2) + ACA-03 **Cao** (TB hệ 4 = 1,0) |
| | 504 | F, A, A | ACA-02 **Cao** (rớt 1); TB 2,67 — không ACA-03 |
| | 505 | D, D, C (đạt hết) | ACA-03 **Cao** (TB 1,33 < 2) |
| | 506 | C, C, C | Không (TB đúng 2,0) |
| | 507 | 1 học phần D (3 tín chỉ) | Không xét ACA-03 (< 6 tín chỉ có điểm) |

**Hội đồng có thể hỏi**: "Thang quy đổi lấy ở đâu?" → Cấu hình luật → ACA-03 → bảng quy đổi điểm chữ (A+ 4 … F 0), đổi được qua phiên bản mới.
