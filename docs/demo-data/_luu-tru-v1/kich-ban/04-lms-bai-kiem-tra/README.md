# Kịch bản 04 — LMS-01 bỏ bài, LMS-02 điểm thấp, bài đến hạn, thiếu điểm tối đa, môn không dùng LMS

**Chạy nhanh** (sau `npm run demo:reset -- --yes`, worker đang chạy):

```bash
npm run demo:scenario -- 4 --evaluate
```

Hoặc trình bày từng bước trên giao diện: Admin → **Nhập dữ liệu** → nạp lần lượt các file trong thư mục này (đúng loại, đúng học kỳ) → **Chạy đánh giá** với mốc dữ liệu ghi dưới đây. Kết quả được kiểm tự động bởi `tests/integration/demo-scenarios.test.ts` (sai 1 dòng là test đỏ).

**Mục đích**: LMS không cho biết hạn nộp → hệ thống tự suy ra "bài đến hạn" (≥ 50% lớp đã nộp VÀ đã qua ≥ 3 ngày từ lượt làm đầu tiên).

**Sinh viên**: KTPM2311401–408 (KTPM541, 8 sinh viên) + 409 (KTPM542, môn không có bài kiểm tra). **Mốc**: 2026-10-10.

Bài: Q1 (14/09, 5/8 nộp → **đến hạn**), Q2 (21/09, 7/8 nộp → **đến hạn**), Q3 (08/10, mới 2 ngày → chưa), Q4 (25/09, 3/8 làm → chưa).

| Sinh viên | Dữ liệu | Kết quả |
|---|---|---|
| 401 | Nộp Q1, Q2 điểm 8 | Không |
| 402 | Bỏ Q1 | LMS-01 **Trung bình** |
| 403 | Bỏ Q1 và Q2 | LMS-01 **Cao** |
| 404 | Q1 chỉ "đang làm", chưa nộp | LMS-01 **Trung bình** (đang làm ≠ đã nộp) |
| 405 | Q1 = 4/10, Q2 = 3/10 rồi làm lại 4,5/10 | LMS-02 **Trung bình** (lấy lượt cao nhất; cả 2 bài < 50%) |
| 406 | Q1 = 5/10 (đúng 50%), Q2 = 3/10 | Không (luật là < 50%) |
| 407 | Q1 thiếu điểm tối đa | Không; ghi **cảnh báo chất lượng dữ liệu** "thiếu thang điểm tối đa" |
| 408 | Nộp đủ | Không |
| 409 | Môn không có bài kiểm tra | LMS "không áp dụng" — không bị coi là thiếu; điểm rủi ro "Thiếu một phần" (chưa có học lực) |

**Hội đồng có thể hỏi**: "Bài chưa ai làm thì sao?" → giới hạn đã biết: không có danh sách bài từ LMS (`docs/rules/08`, mục Giới hạn).
