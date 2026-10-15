# Đo hiệu năng (Phase 7, 2026-10-15)

Đối chiếu `docs/rules/05-performance.md`. Dữ liệu GIẢ trên DB riêng `ewars_perf` (không đụng DB demo).

**Cách chạy lại**

```bash
# 1 lần: tạo DB + schema (thay ewars bằng tên DB của bạn)
docker compose exec postgres psql -U ewars -d ewars -c "CREATE DATABASE ewars_perf"
DATABASE_URL=postgresql://ewars:<mật khẩu>@localhost:5432/ewars_perf npm run db:init
DATABASE_URL=… npm run migration:run && DATABASE_URL=… npm run seed
DATABASE_URL=… npm run perf:seed      # sinh dữ liệu (~20 giây)
DATABASE_URL=… npm run perf:measure   # in các bảng dưới đây
```

**Quy mô dữ liệu** (`scripts/perf-config.ts`, ngẫu nhiên có seed cố định): 5.000 sinh viên · 100 lớp sinh hoạt (5 khoa) · 50 Cố vấn học tập · 40 học phần · 2 học kỳ. Học kỳ hiện tại: 25.000 lượt đăng ký học phần, 50.000 dòng điểm danh (2 lần chốt), 91.375 lượt làm bài LMS, 25.000 điểm quá trình. Học kỳ trước: 10.000 kết quả cuối kỳ (598 lượt rớt → có học lại).

**Máy đo**: AMD Ryzen 7 8745H, RAM 15 GB, Windows 11; PostgreSQL 16 trong Docker; Node 22 chạy ngoài Docker (giống worker). Mốc dữ liệu `asOf` = 10/10/2026.

## Chạy đánh giá 1 học kỳ

| Lần chạy | Sinh viên | Dấu hiệu | Cảnh báo mới / cập nhật | Thời gian | Bộ nhớ heap cao nhất |
|---|---|---|---|---|---|
| Cả học kỳ — lần đầu (tạo cảnh báo) | 5000 | 19379 | 3855 / 0 | 22.3 giây | 180 MB |
| Cả học kỳ — chạy lại (cập nhật) | 5000 | 19379 | 0 / 3855 | 16.1 giây | 198 MB |
| Theo 1 học phần | 650 | 518 | 0 / 220 | 2.4 giây | 206 MB |

## Truy vấn màn hình (trung vị 5 lần, sau 1 lần làm nóng)

| Màn hình / truy vấn | Thời gian |
|---|---|
| Danh sách cảnh báo Admin (tối đa 500) | 106 ms |
| Danh sách cảnh báo Admin, lọc 1 khoa | 105 ms |
| Cảnh báo cần xử lý của 1 Cố vấn học tập | 21 ms |
| Chi tiết 1 cảnh báo | 8 ms |
| Hồ sơ học tập 1 sinh viên | 5 ms |
| Tổng quan Admin (toàn trường) | 10 ms |
| Tổng quan Admin (1 khoa) | 11 ms |
| Trang "Bắt đầu" (đếm dữ liệu) | 42 ms |
| Form chạy đánh giá (học phần theo khoa) | 47 ms |
| Tìm sinh viên (trang 1) | 7 ms |
| Nhật ký hệ thống (trang 1, không lọc) | 4 ms |

## EXPLAIN ANALYZE — danh sách cảnh báo của 1 Cố vấn học tập

```
Nested Loop  (cost=0.56..69.26 rows=57 width=154) (actual time=0.029..0.161 rows=71 loops=1)
  Buffers: shared hit=279
  ->  Nested Loop  (cost=0.28..22.56 rows=100 width=8) (actual time=0.015..0.035 rows=100 loops=1)
        Buffers: shared hit=8
        ->  Seq Scan on administrative_classes c  (cost=0.00..3.25 rows=2 width=9) (actual time=0.004..0.008 rows=2 loops=1)
              Filter: ((advisor_id)::text = 'PGV001'::text)
              Rows Removed by Filter: 98
              Buffers: shared hit=2
        ->  Index Scan using "IDX_de6ad4ae6936dce474e2823984" on students s  (cost=0.28..9.16 rows=50 width=17) (actual time=0.006..0.010 rows=50 loops=2)
              Index Cond: ((class_id)::text = (c.class_id)::text)
              Buffers: shared hit=6
  ->  Index Scan using "IDX_32d95b6b7b8f2ef210d908de0f" on alerts a  (cost=0.28..0.46 rows=1 width=154) (actual time=0.001..0.001 rows=1 loops=100)
        Index Cond: (((student_id)::text = (s.student_id)::text) AND ((term_id)::text = 'PHK1_2026'::text))
        Filter: (status = ANY ('{OPEN,ACKNOWLEDGED,IN_PROGRESS,REOPENED}'::alert_status[]))
        Buffers: shared hit=271
Planning:
  Buffers: shared hit=15
Planning Time: 0.316 ms
Execution Time: 0.197 ms
```

## EXPLAIN ANALYZE — danh sách cảnh báo Admin

```
Hash Join  (cost=158.75..348.34 rows=2832 width=154) (actual time=0.904..2.476 rows=3855 loops=1)
  Hash Cond: ((s.class_id)::text = (c.class_id)::text)
  Buffers: shared hit=183
  ->  Hash Join  (cost=154.50..336.35 rows=2832 width=163) (actual time=0.876..1.964 rows=3855 loops=1)
        Hash Cond: ((a.student_id)::text = (s.student_id)::text)
        Buffers: shared hit=181
        ->  Seq Scan on alerts a  (cost=0.00..174.40 rows=2832 width=154) (actual time=0.006..0.398 rows=3855 loops=1)
              Filter: ((term_id)::text = 'PHK1_2026'::text)
              Buffers: shared hit=139
        ->  Hash  (cost=92.00..92.00 rows=5000 width=17) (actual time=0.783..0.783 rows=5000 loops=1)
              Buckets: 8192  Batches: 1  Memory Usage: 304kB
              Buffers: shared hit=42
              ->  Seq Scan on students s  (cost=0.00..92.00 rows=5000 width=17) (actual time=0.003..0.256 rows=5000 loops=1)
                    Buffers: shared hit=42
  ->  Hash  (cost=3.00..3.00 rows=100 width=9) (actual time=0.020..0.020 rows=100 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 13kB
        Buffers: shared hit=2
        ->  Seq Scan on administrative_classes c  (cost=0.00..3.00 rows=100 width=9) (actual time=0.002..0.007 rows=100 loops=1)
              Buffers: shared hit=2
Planning:
  Buffers: shared hit=15
Planning Time: 0.304 ms
Execution Time: 2.742 ms
```

## Kết luận

- Chạy đánh giá cả học kỳ 5.000 sinh viên mất **~22 giây** (lô 200 sinh viên/transaction), bộ nhớ < 210 MB — chạy nền trong worker, không chặn người dùng; lịch chạy mỗi đêm (2h sáng) dư thời gian.
- Mọi màn hình danh sách đều **< 300 ms** (chậm nhất: danh sách cảnh báo Admin ~106 ms vì trả tối đa 500 dòng kèm tóm tắt dấu hiệu) → theo quyết định 2026-10-15, **giữ phân trang `skip/take`**, chưa cần keyset (`docs/rules/05` đã cập nhật).
- Truy vấn danh sách cảnh báo của Cố vấn học tập dùng index (`administrative_classes` → `students(class_id)` → `alerts(student_id, term_id, status)`), thực thi < 1 ms. Danh sách Admin quét tuần tự bảng `alerts` theo học kỳ (~3 ms) — chấp nhận ở quy mô này.
- Dữ liệu giả có tỷ lệ cảnh báo cao (~77% sinh viên, chủ yếu `LMS-01` do mỗi bài có 5% sinh viên bỏ, 20 bài/học kỳ) — kịch bản xấu hơn thực tế, nên số đo là cận trên.
