# Kiểm thử (Phase 7, 2026-10-15)

Đối chiếu `docs/rules/02-code-quality.md`.

## Tự động

| Loại | Số lượng | Lệnh | Ghi chú |
|---|---|---|---|
| Unit + tích hợp (Vitest, PostgreSQL thật) | 356 test | `npm test` | CI chạy mỗi PR |
| Nghiệm thu bộ demo chính | 2 file | `rule-engine-acceptance.test.ts`, `alerts.test.ts` | Đúng và đủ 17 dấu hiệu, 12 cảnh báo của `KET_QUA_MONG_DOI.md` |
| Nghiệm thu 8 kịch bản nhỏ | 8 test | `demo-scenarios.test.ts` | Đọc `docs/demo-data/kich-ban/*/scenario.json`; thừa/thiếu 1 dấu hiệu là đỏ (đã thử cố ý sửa sai → test đỏ) |
| End-to-end (Playwright, trên máy) | 2 luồng | `npm run test:e2e` | (1) nhập file lỗi → xem dòng lỗi → tải file lỗi → nạp lại → hoàn tác; (2) Cố vấn học tập xác nhận + ghi can thiệp |
| Responsive + chế độ tối | 40 ảnh | `npm run screenshots` | 3 khổ (1440, 768, 390 px) × sáng; khổ desktop × tối; tự kiểm tràn ngang — **0 trang tràn** (đã sửa 1 lỗi biểu đồ Tổng quan trên điện thoại). Ảnh ở `docs/screenshots/` |

## Độ phủ (dòng lệnh)

| Module | Đạt | Ngưỡng (`02`) |
|---|---|---|
| `modules/rule-engine` | **91,4%** | ≥ 90% |
| `modules/data-import` | **89,2%** | ≥ 80% |
| `modules/alerts` | 76,5% | ≥ 60% |
| `modules/admin` | 74,0% | ≥ 60% |
| `lib` | 60,8% | ≥ 60% |
| Toàn bộ | 83,1% | — |

Lệnh: `npm run test:coverage`.

## Test bắt buộc theo `02`

- Mỗi luật có test đặt tên theo mã luật (`tests/unit/rule-engine/*`).
- Chính sách thiếu dữ liệu FULL / PARTIAL / INSUFFICIENT và chống rò rỉ thời gian (`risk-score-and-time.test.ts`).
- Cố vấn học tập A không xem được sinh viên của B (`authz-scope.test.ts`, `alerts.test.ts`).
- Mọi hàm `list*` trả object thuần (`expectPlain`).
