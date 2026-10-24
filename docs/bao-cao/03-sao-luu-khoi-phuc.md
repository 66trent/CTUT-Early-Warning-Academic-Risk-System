# Sao lưu và khôi phục (Phase 7, 2026-10-15; diễn tập lại Phase 9c, 2026-10-24)

Đối chiếu `docs/rules/01` (Backup & Restore): RPO ≤ 24 giờ, RTO ≤ 4 giờ, diễn tập ít nhất 1 lần.

## Lệnh

| Việc | Lệnh |
|---|---|
| Sao lưu | `npm run backup` → `backups/ewars-YYYYMMDD-HHmmss.dump` (`pg_dump -Fc`, giữ 7 bản mới nhất) |
| Khôi phục thử (không đụng DB chính) | `npm run restore -- backups/<file>.dump` → DB `<tên DB>_restore` |
| Khôi phục đè DB chính | Dừng app + worker → `npm run restore -- backups/<file>.dump --into-main --yes` → chạy lại app + worker |

Người dùng chốt (2026-10-15): lệnh chạy tay + hướng dẫn đặt lịch hằng ngày (README, mục "Sao lưu"); không thêm container sao lưu tự động. Đặt lịch 1 lần/ngày lúc 1h sáng → **RPO ≤ 24 giờ**.

## Diễn tập khôi phục

| DB | Kích thước bản sao lưu | Thời gian sao lưu | Thời gian khôi phục | Kiểm tra |
|---|---|---|---|---|
| DB demo `ewars` — bộ v3 sau chốt học kỳ (100 sinh viên, 35 cảnh báo; 2026-10-24) | 309 KB | 0,6 giây | 2,0 giây | Số dòng 32 bảng (`public` + `auth`) khớp 100% |
| DB demo `ewars` — bộ v1 (13 sinh viên, 12 cảnh báo; Phase 7) | 112 KB | 0,5 giây | 1,9 giây | Số dòng 28 bảng khớp 100% |
| DB hiệu năng `ewars_perf` (5.000 sinh viên, ~230.000 dòng dữ liệu nguồn) | 10,7 MB | 1,4 giây | 3,7 giây | Số dòng mọi bảng khớp 100% |

→ Khôi phục ở quy mô 5.000 sinh viên mất vài giây; cộng thời gian dừng/chạy lại container (~1 phút) vẫn **RTO ≪ 4 giờ**.

## Lưu ý

- File sao lưu chứa dữ liệu cá nhân → lưu tách khỏi máy chủ chính, giới hạn quyền truy cập như dữ liệu thật (`docs/rules/04`). Thư mục `backups/` đã `.gitignore`.
- Bản sao lưu chỉ gồm PostgreSQL. File gốc các lô nhập nằm trong MinIO (bucket `MINIO_BUCKET`) — sao lưu riêng bằng công cụ của MinIO (`mc mirror`) khi triển khai thật.
