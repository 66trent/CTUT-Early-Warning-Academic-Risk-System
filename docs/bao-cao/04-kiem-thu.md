# Kiểm thử (Phase 7, 2026-10-15; cập nhật Phase 9c, 2026-10-24)

Đối chiếu `docs/rules/02-code-quality.md`.

## Tự động

| Loại | Số lượng | Lệnh | Ghi chú |
|---|---|---|---|
| Unit + tích hợp (Vitest, PostgreSQL thật) | 415 test, 36 file | `npm test` | CI chạy mỗi PR |
| Nghiệm thu bộ demo v3 (5 lớp, 100 sinh viên) | 9 ca | `demo-v3-acceptance.test.ts` | Đúng và đủ 41 / 27 / 29 dấu hiệu, 24 → 29 → 35 cảnh báo, thông báo 24/22 · 6/6 · 7/7 của `KET_QUA_MONG_DOI.md`; so khớp TOÀN BỘ tập dấu hiệu 100 sinh viên |
| Kiểm thử tính năng trên bộ v2 | 2 file | `rule-engine-acceptance.test.ts`, `alerts.test.ts` | Fixture `docs/demo-data/_luu-tru-v2/` |
| End-to-end (Playwright, trên máy) | 2 luồng | `npm run test:e2e` | (1) nạp 2 file 1 lần có dòng lỗi → tải file lỗi → sửa → nạp lại → hoàn tác; (2) Cố vấn học tập xác nhận + ghi can thiệp. Xanh trên image Docker production (2026-10-24) |
| Responsive + chế độ tối | 62 ảnh + 4 ảnh sau chốt | `npm run screenshots` (`-- --closed`) | 3 khổ (1440, 768, 390 px) × sáng; khổ desktop × tối; tự kiểm tràn ngang — **0 trang tràn**. Ảnh ở `docs/screenshots/` |

8 kịch bản nhỏ của Phase 7 (`demo-scenarios.test.ts`) đã gỡ ở Phase 9c — tình huống gộp vào chủ đề 5 lớp của bộ v3.

## Độ phủ (dòng lệnh, đo lại 2026-10-24)

| Module | Đạt | Ngưỡng (`02`) |
|---|---|---|
| `modules/rule-engine` | **92,3%** | ≥ 90% |
| `modules/data-import` | **89,3%** | ≥ 80% |
| `modules/alerts` | 82,6% | ≥ 60% |
| `modules/admin` | 79,0% | ≥ 60% |
| `lib` | 67,8% | ≥ 60% |
| Toàn bộ | 85,7% | — |

Lệnh: `npm run test:coverage`.

## Test bắt buộc theo `02`

- Mỗi luật có test đặt tên theo mã luật (`tests/unit/rule-engine/*`).
- Chính sách thiếu dữ liệu FULL / PARTIAL / INSUFFICIENT và chống rò rỉ thời gian (`risk-score-and-time.test.ts`).
- Cố vấn học tập A không xem được sinh viên của B (`authz-scope.test.ts`, `alerts.test.ts`).
- Mọi hàm `list*` trả object thuần (`expectPlain`).
