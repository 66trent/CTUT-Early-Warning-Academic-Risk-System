# Kịch bản 08 — Vòng đời cảnh báo: tạo, thông báo, xử lý, mở lại khi nặng hơn, hoàn tác lô

**Chạy nhanh** (sau `npm run demo:reset -- --yes`, worker đang chạy):

```bash
npm run demo:scenario -- 8 --evaluate
```

Hoặc trình bày từng bước trên giao diện: Admin → **Nhập dữ liệu** → nạp lần lượt các file trong thư mục này (đúng loại, đúng học kỳ) → **Chạy đánh giá** với mốc dữ liệu ghi dưới đây. Kết quả được kiểm tự động bởi `tests/integration/demo-scenarios.test.ts` (sai 1 dòng là test đỏ).

**Mục đích**: 1 cảnh báo / sinh viên / học kỳ đi qua đủ vòng đời; thông báo chỉ khi có điều mới.

**Sinh viên**: KTPM2311801, 802 (lớp KTPM2311 → GV001), KTPM2311803 (lớp **KHMT2311** → GV002). **Học phần**: KTPM581.

**Đợt 1** — `npm run demo:scenario -- 8 --evaluate` (chốt 02/10, mốc **2026-10-03**):

| Sinh viên | Kết quả | Thông báo |
|---|---|---|
| 801 | Vắng 10% → cảnh báo **Trung bình** | Trong ứng dụng + email (MailHog http://localhost:8025) |
| 802 | Trễ 3 → **Thấp** | Chỉ trong ứng dụng |

**Xử lý** — đăng nhập nhanh GV001 → mở cảnh báo 801 → **Xác nhận đã xem** → ghi can thiệp → **Đã giải quyết**.

**Đợt 2** — `npm run demo:scenario -- 8 --wave 2 --evaluate` (chốt 09/10, mốc **2026-10-10**):

| Sinh viên | Kết quả | Thông báo |
|---|---|---|
| 801 | Vắng 16,7% (Cao) + tăng 2 buổi (ATT-02 Cao) → cảnh báo đã giải quyết được **MỞ LẠI**, mức Cao | Có (mở lại) |
| 802 | Vẫn trễ 3 → mức không đổi | **Không** gửi lại |
| 803 | Vắng 23,3% → **Rất cao**, chỉ **GV002** thấy | Email tới GV002 |

**Hoàn tác** — Admin → Nhập dữ liệu → lô `03_diem_danh_dot2.csv` → **Hoàn tác lô** → hệ thống tự chạy lại: cảnh báo 803 (chỉ có dữ liệu đợt 2) → **Không còn hiệu lực**.

**Hội đồng có thể hỏi**: "Chạy lại nhiều lần có gửi email trùng?" → không: chỉ gửi khi cảnh báo mới, mở lại hoặc tăng mức (`docs/rules/06`).
