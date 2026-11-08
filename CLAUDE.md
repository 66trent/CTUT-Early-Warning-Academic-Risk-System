# CTUT-EWARS — Hệ thống cảnh báo sớm rủi ro học tập dựa trên luật nghiệp vụ

Đồ án tốt nghiệp. Next.js 16 fullstack · PostgreSQL · TypeORM · Better Auth · BullMQ + Redis · MinIO · Tailwind 4 + shadcn/ui · Docker.
3 role: `STUDENT`, `ADVISOR` (cố vấn học tập), `ADMIN`. Dữ liệu vào bằng file CSV hoặc Excel (.xlsx): danh sách sinh viên + 4 nguồn (điểm danh theo tiết, bài trắc nghiệm LMS, bài thực hành LMS, kết quả học phần đã khóa điểm). 12 luật cảnh báo (Phase 8a).

## Luôn đọc trước khi code

@docs/HANDOFF.md
@docs/rules/00-project-context.md
@docs/rules/01-architecture.md
@docs/rules/02-code-quality.md
@docs/rules/06-security.md

## Đọc thêm theo loại việc

- Luật cảnh báo, rule engine, RiskScore → `docs/rules/08-business-rules-catalog.md`
- Entity, migration → `docs/rules/09-data-schema-identity.md`, `10-data-schema-source-records.md`, `11-data-schema-rule-engine.md`, `12-data-schema-ops.md`
- Nhập CSV → `12`, `10`, và mẫu trong `public/templates/`
- Giao diện → `03-ui-design.md`, `07-ux-design.md`
- Dữ liệu cá nhân, ẩn danh hóa → `04-legal-compliance.md`; hiệu năng → `05-performance.md`
- Kiểm thử nghiệm thu, demo → `docs/demo-data/KET_QUA_MONG_DOI.md`
- Vì sao một quy tắc tồn tại, code cũ nên tham khảo → `docs/bai-hoc-du-an-cu.md`

## Cách làm việc

- Kế hoạch ở `docs/implement.md`. Người dùng yêu cầu theo phase (VD: "Thực hiện Phase 1"). Chỉ làm đúng phase đó; xong thì tick checklist, ghi ≤ 15 dòng vào `PROGRESS.md`, báo kết quả theo DoD và hướng dẫn người dùng tự kiểm tra trên giao diện.
- Quyết định mới ngoài rules → cập nhật file rule ngay và nói rõ đã đổi gì. Đặc tả có vẻ sai nghiệp vụ → dừng và hỏi.
- Không tự bịa danh mục thật (khoa, đuôi email, quy chế) — hỏi người dùng.
- Kết thúc mỗi việc: `npm run typecheck`, `npm run lint`, `npm test`. Kết thúc phase: thêm `npm run build`.
- Không commit/push khi chưa được yêu cầu. Trước migration đổi/xóa bảng có dữ liệu: nhắc backup.
- Trả lời người dùng bằng tiếng Việt, ngắn gọn, dễ hiểu (người dùng là sinh viên làm đồ án, không cần thuật ngữ thừa).

## Lệnh

`npm run dev` · `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm test` · `npm run build` · `npm run db:init` · `npm run migration:run` · `npm run seed` · `npm run seed:demo`
