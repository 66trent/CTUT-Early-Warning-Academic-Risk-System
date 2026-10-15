# 05 — Tối ưu Hiệu suất

Xem `00-project-context.md` cho glossary.

## Truy vấn cơ sở dữ liệu

- MUST: mọi query danh sách (tổng quan, lịch sử nhập liệu, danh sách cảnh báo) phân trang (keyset theo `(createdAt, id)` cho danh sách lớn; `take`/`skip` cho danh sách nhỏ — người dùng chốt 2026-10-15: danh sách nào > 300ms mới đổi sang keyset — đo Phase 7 với 5.000 sinh viên: mọi danh sách < 110ms, giữ `take`/`skip`; xem `docs/bao-cao/02-hieu-nang.md`) — MUST NOT truy vấn danh sách không có `take`/giới hạn.
- MUST: có index trên `Alert(studentId, termId, status)`, `RuleTrigger(termId, ruleCode)`, `ImportErrorRow(importBatchId, resolved)` ngoài các unique index theo khóa nghiệp vụ đã có trong `00-project-context.md`.
- MUST: chọn cột tường minh (`select` của `find*` hoặc `QueryBuilder.select()`) và nạp quan hệ tường minh — MUST NOT load nguyên entity khi chỉ cần vài field, đặc biệt tránh load `RuleTrigger.inputSnapshot` (jsonb lớn) khi chỉ cần đếm số lượng. Khai báo index bằng `@Index`.
- MUST: job tính RiskScore cho toàn khoa chạy theo batch/chunk qua `Enrollment` (khuyến nghị 200 sinh viên/lần) — MUST NOT load toàn bộ dữ liệu 1 khoa vào memory cùng lúc.

## Job nền (BullMQ)

- MUST: ngoài chạy tự động sau nạp và chạy tay, có lịch chạy đánh giá cả học kỳ hiện tại mỗi đêm (job lặp BullMQ trên queue `evaluation-run`, giờ đọc từ biến môi trường, mặc định 02:00 giờ Việt Nam; `EvaluationRun.trigger = SCHEDULED`) — để bắt bài LMS mới đến hạn và điểm danh quá hạn khi không có file mới (người dùng chốt 2026-10-15, không có nút bật/tắt; TẮT khi `DEMO_MODE=true` vì dữ liệu demo có ngày cố định). MUST NOT chạy đánh giá đồng bộ trong request-response người dùng.
- MUST: giới hạn concurrency worker phù hợp connection pool PostgreSQL (ví dụ `concurrency: 5`).
- SHOULD: log thời gian thực thi mỗi job để phát hiện suy giảm hiệu năng theo thời gian.

## Kết nối cơ sở dữ liệu

- MUST: `DataSource` TypeORM dùng singleton (cache `globalThis`) trong `db/data-source.ts` để tránh rò rỉ connection khi hot-reload dev.
- MUST: giới hạn kích thước pool bằng `extra: { max: N }` của `DataSource`, tách cấu hình riêng cho `app` (ưu tiên phản hồi nhanh) và `worker` (tránh tranh chấp khi job chạy nặng); tổng `max` của mọi process MUST nhỏ hơn `max_connections` của PostgreSQL.

## Frontend

- MUST: dùng React Server Components mặc định — chỉ đánh dấu `"use client"` khi thực sự cần tương tác (form, biểu đồ (Recharts), dropdown filter).
- MUST: biểu đồ (Recharts) render dữ liệu đã tổng hợp sẵn ở server — MUST NOT gửi raw data lớn xuống client để tính toán ở trình duyệt.
- MUST: lazy-load nội dung `RuleTrigger.inputSnapshot` chi tiết — chỉ fetch khi người dùng mở Accordion, không tải sẵn toàn bộ evidence của mọi `Alert` trong danh sách.
- SHOULD: cache danh mục ít thay đổi (`Course`, `Rule` — không phải `RuleVersion`) bằng `unstable_cache`/`revalidateTag`.

## Xử lý file nhập liệu

- MUST: đọc file CSV theo stream (`csv-parse`) — MUST NOT load toàn bộ file vào memory trước khi xử lý. Ngoại lệ đã đo và chấp nhận: XLSX đọc cả file vào bộ nhớ (`exceljs` `xlsx.load`) vì bản stream của exceljs bỏ sót dữ liệu tùy thứ tự mục trong file nén; bộ nhớ có trần nhờ giới hạn 20MB / 100MB giải nén / 50.000 dòng (~270MB heap ở mức trần), queue nhập chạy 1 job/lần. (`papaparse` ở chế độ stream chậm bậc hai theo kích thước mảnh — 50.000 dòng mất ~38 giây — nên không dùng.)
- MUST: validate + đối chiếu danh mục chạy theo batch trong transaction TypeORM (`dataSource.transaction`) vừa đủ nhỏ (khuyến nghị 500 dòng/transaction) — MUST NOT mở 1 transaction cho toàn bộ file.

## Redis

- MUST: dùng Redis cho BullMQ queue (và rate-limit nếu cần — xem `06-security.md`). Không dùng Redis để chống gửi trùng thông báo (đã bỏ).

## Đo lường

- MUST: chạy `EXPLAIN ANALYZE` trên query tổng quan/RiskScore trước khi coi là đã tối ưu — không tối ưu dựa trên phỏng đoán. Dùng dữ liệu seed đủ lớn để đo thực tế (khuyến nghị: 5.000 sinh viên × 1 học kỳ).
