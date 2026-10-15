# 02 — Chất lượng Code

Xem `00-project-context.md` cho glossary. File này quy định tiêu chuẩn code và kiểm thử.

## TypeScript

- MUST: `strict: true` trong `tsconfig.json`, không tắt bất kỳ cờ strict nào.
- MUST NOT: dùng `any`. Dùng `unknown` + type guard, hoặc định nghĩa type rõ ràng. Nếu buộc phải dùng `any` (thư viện ngoài không có type), bắt buộc có comment `// TODO: any vì <lý do>`.
- MUST: mọi input từ bên ngoài hệ thống (file upload, webhook, form) qua Zod `.parse()`/`.safeParse()` trước khi dùng.

## Quy ước đặt tên

- MUST: tên bảng/field/biến/hàm dùng tiếng Anh, khớp glossary trong `00-project-context.md`. MUST NOT tự đặt tên khác (VD: không viết `hocSinhId` khi entity glossary ghi `studentId`).
- MUST: tên file `kebab-case.ts`; tên component React `PascalCase.tsx`; tên hàm/biến `camelCase`.
- MUST: mã luật (`RuleCode`) giữ nguyên định dạng gốc dạng `ATT-01` khi dùng làm hằng số trong code, không viết tắt hay đổi định dạng.

## Cấu trúc hàm

- MUST: một hàm chỉ làm một việc. Hàm trong `services/` không vượt quá ~50 dòng logic thực.
- MUST: hàm trong `modules/rule-engine/evaluator/` là pure function — test được bằng fixture data, không cần DB thật.
- MUST NOT: dùng `console.log` trong code production — dùng logger có cấu hình level (`debug/info/warn/error`).

## Kiểm thử

- MUST: mỗi rule nghiệp vụ (`ATT-*`, `LMS-*`, `ACA-*`, `COMB-*`) có ít nhất 1 test case Vitest đặt tên theo mã luật, ví dụ:
  ```ts
  describe('ATT-01: tỷ lệ vắng không phép', () => {
    it('MEDIUM khi vắng không phép 2/16 buổi (12.5%)', () => { ... })
    it('không xét khi mới học 3 buổi (< minSessions)', () => { ... })
  })
  ```
- MUST: coverage tối thiểu — `modules/rule-engine/**` ≥ 90%; `modules/data-import/**` ≥ 80%; các module khác ≥ 60%.
- MUST: có test riêng cho chính sách dữ liệu thiếu — 3 tình huống thiếu 0/1/2/3 trong 3 nhóm chỉ số phải cho đúng 3 kết quả `FULL`/`PARTIAL`/`INSUFFICIENT`.
- MUST: có test riêng chống temporal leakage — RiskScore tính tại thời điểm t không được thay đổi khi thêm dữ liệu phát sinh sau t vào fixture.
- MUST: có test nghiệm thu nạp toàn bộ `docs/demo-data/` theo đúng thứ tự trong `docs/demo-data/KET_QUA_MONG_DOI.md`, chạy đánh giá với `asOf` ghi trong file, và so khớp ĐÚNG danh sách cảnh báo mong đợi (thừa hay thiếu đều là lỗi). Khi luật đổi, sửa file kết quả mong đợi trước, rồi mới sửa code.
- SHOULD: dùng Playwright cho luồng end-to-end quan trọng: nhập file có lỗi → xem dòng lỗi → sửa và nhập lại; CVHT xác nhận cảnh báo và ghi can thiệp.

## Checklist bắt buộc trước khi merge Pull Request

- [ ] Không có `any` mới không giải thích.
- [ ] Mọi Server Action đọc/ghi dữ liệu sinh viên gọi `assertScope()` trước khi truy vấn (xem `06-security.md`).
- [ ] Mọi thao tác cấu hình luật / xóa batch / đổi trạng thái `Alert` gọi `writeAuditLog()`.
- [ ] Không có đường nào (trực tiếp hoặc gián tiếp) ghi vào `Student.officialAcademicStatus` ngoài module đồng bộ SIS.
- [ ] Test mới cho mọi nhánh logic mới trong `rule-engine`/`data-import`.
- [ ] Không hard-code ngưỡng luật (số buổi, %, ngày...) trong code — luôn đọc từ `RuleVersion.condition`.

## Công cụ tự động

- MUST: ESLint (`next/core-web-vitals` + `@typescript-eslint/recommended-requiring-type-checking`) chạy trong CI, fail build nếu có lỗi.
- MUST: Prettier + Husky pre-commit (`lint-staged`) — không tranh luận style trong code review.
- MUST: Vitest + Playwright chạy trong CI; PR không được merge nếu test fail.
- MUST: chạy kiểm tra schema drift trong CI (`typeorm migration:generate --check` hoặc lệnh tương đương của phiên bản TypeORM đang dùng) và chạy migration trên DB trống để chắc chắn migration chạy được từ đầu.

## Git

- SHOULD: commit message tham chiếu mã luật/module khi liên quan, ví dụ: `feat(data-import): implement duplicate check via checksum`.
- MUST NOT: commit trực tiếp lên `main` — mọi thay đổi qua Pull Request có review.

## Báo cáo tiến độ

- MUST: sau mỗi bước trong `docs/implement.md`, ghi tối đa ~15 dòng vào `PROGRESS.md`: đã làm gì, file chính, kết quả test, việc còn lại, cách tự kiểm tra trên giao diện. MUST NOT viết báo cáo dài lặp lại nội dung rules.
- MUST: báo "xong" chỉ khi đạt DoD của bước, kể cả mục kiểm tra tay trên giao diện. Test xanh chứng minh code khớp đặc tả, KHÔNG chứng minh đặc tả đúng nghiệp vụ — nếu phát hiện đặc tả bất hợp lý, dừng lại hỏi người dùng.
