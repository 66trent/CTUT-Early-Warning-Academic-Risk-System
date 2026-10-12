# Bàn giao ngữ cảnh — CTUT-EWARS

> Đọc file này đầu tiên khi bắt đầu phiên mới. Cập nhật lần cuối: 2026-10-13 (sau Phase 4).
> Nguồn sự thật nghiệp vụ/kỹ thuật vẫn là `CLAUDE.md` + `docs/rules/00–12`; file này chỉ ghi **trạng thái, quyết định đã chốt với người dùng, và bẫy đã gặp** — những thứ không đọc được từ code.

## 1. Trạng thái

| Phase | Trạng thái | Nhánh | PR | CI |
|---|---|---|---|---|
| 0 Hạ tầng | Xong, đạt DoD | `phase-0` | #1 → `main` | xanh |
| 1 Xác thực, danh tính | Xong | `phase-1` | #2 → `phase-0` | xanh |
| 2 Danh mục quản trị | Xong (mục sĩ số đã kiểm ở 3a) | `phase-2` | #3 → `phase-1` | xanh |
| 3a Khung nhập + sinh viên | Xong | `phase-3a` | #4 → `phase-2` | xanh |
| 3b Nhập 3 nguồn học tập | Xong | `phase-3b` | #5 → `phase-3a` | xem PR |
| 4 Rule engine (+ sửa lỗi font/mẫu Excel của Phase 3) | Xong | `phase-4` (đang checkout) | #6 → `phase-3b` | xem PR |
| **5 Cảnh báo, CVHT, sinh viên** | **Việc tiếp theo** | tạo `phase-5` từ `phase-4` | base `phase-4` | — |

- Repo: https://github.com/66trent/CTUT-Early-Warning-Academic-Risk-System — **PR xếp chồng, CHƯA merge**. Người dùng merge theo thứ tự #1 → #2 → #3 → #4 → #5 → #6 (GitHub tự đổi base).
- Quy trình mỗi phase (người dùng đã đồng ý, làm liên tục từ Phase 0): code → `typecheck`, `lint`, `format:check`, `migration:check`, `test`, `build` → kiểm tra tay trên trình duyệt → tick `docs/implement.md` → ghi `PROGRESS.md` (≤15 dòng) → commit (kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`) → push → `gh pr create` (body kết thúc bằng `🤖 Generated with [Claude Code](https://claude.com/claude-code)`) → `bind_pr` → báo kết quả theo DoD + hướng dẫn tự kiểm tra.
- `gh` CLI đã cài và đăng nhập (tài khoản `66trent`). Trong Git Bash gọi bằng `"/c/Program Files/GitHub CLI/gh.exe"`.

## 2. Môi trường đang chạy

- Docker Compose (project `ewars`): `app` (3000), `worker`, `postgres` (5432), `redis` (6379), `minio` (9000/9001), `mailhog` (1025/8025, profile `dev`) — port chỉ mở `127.0.0.1`. Image app/worker đã build theo code Phase 4 (worker có queue `evaluation-run`).
- Container dự án CŨ (`ctut-ewars-*`, ở `E:\CTUT-EWARS`) đã **dừng** (không xóa) để nhường port.
- `.env` (không commit): `STAFF_EMAIL_DOMAIN=*` (tạm thời, người dùng chưa có email trường — phải đặt lại `@ctuet.edu.vn` khi triển khai thật); `DEMO_MODE=true`; có thêm `POSTGRES_USER/PASSWORD/DB` khớp `DATABASE_URL`. Better Auth cảnh báo `AUTH_SECRET` độ ngẫu nhiên thấp — đã nhắc người dùng thay.
- Dữ liệu trong DB dev (của người dùng, KHÔNG tự xóa/sửa):
  - Tài khoản: `ADMIN` (seed), `GV001`/`GV002` (seed:demo), `GV02` (người dùng tự đăng ký, ACTIVE, đang phụ trách lớp `KTPM2311`), `CVHT0001` (người dùng, PENDING).
  - Học kỳ: `HK2_2025`, `HK1_2026` (hiện tại, đã mở lại bằng `seed:demo` 2026-10-12 theo yêu cầu người dùng), `HK2_2026` (người dùng tự tạo).
  - Lớp: `KTPM2311` (GV001 — `seed:demo` đặt lại theo kịch bản demo), `KHMT2311` (GV002). Sinh viên: 13.
  - Đã nạp đủ demo 02–05 bằng `npm run demo:load` (2026-10-13) + 5 lần chạy đánh giá (4 tự động, 1 tay mốc 10/10 → 13 trigger). Rule seed 10 luật + `RISK-SCORE` v1.
  - Backup trước khi đổi: `backups/before-demo-reset-20261012.dump`.
- Chạy app ở máy (khi cần thử giao diện): `docker compose stop app worker` → Browser pane `preview_start` tên `next-dev` (cổng 3000, `.claude/launch.json`) + worker bằng `npx tsx src/workers/index.ts` chạy nền. Xong thì tắt worker (xem bẫy #4) và `docker compose --profile dev up -d --build app worker`.

## 3. Quyết định đã chốt với người dùng (ngoài/đã ghi vào rules)

- Ngày trong `docs/demo-data` chuyển sang `YYYY-MM-DD` (Excel đã tự đổi sang kiểu Mỹ).
- Bỏ hoàn toàn chống gửi trùng / giới hạn tần suất thông báo; chỉ gửi khi Alert mới, REOPENED, hoặc tăng mức (`06`).
- Mã khoa Cơ khí chính thức: `K.KTCK` (không phải `K.CK`).
- Thang điểm 9 mức: A+ 9,5–10 · A 8,5–9,4 · B+ 8,0–8,4 · B 7,0–7,9 · C+ 6,5–6,9 · C 5,5–6,4 · D+ 5,0–5,4 · D 4,0–4,9 · F <4. Hệ 4: A+ 4 · A 4 · B+ 3,5 · B 3 · C+ 2,5 · C 2 · D+ 1,5 · D 1 · F 0. `letterGrade` String(2); KHÔNG lưu `gradePoint4` — engine quy đổi lúc đánh giá; so sánh nửa điểm bằng số nguyên (`08`, `10`). Dữ liệu demo HK2 đã sửa theo thang này, danh sách cảnh báo mong đợi không đổi.
- Nhập dữ liệu: 2 bước (xem trước → xác nhận), nhận CSV + `.xlsx`, chia Phase 3 thành 3a/3b, hoàn tác lô **có điều kiện**, kiểm tra lại khi xác nhận, tự hủy lô chờ > 7 ngày, cảnh báo lỗi > 10%, khóa nạp theo (loại, học kỳ), ≤ 50.000 dòng, chống zip bomb, chống chèn công thức (`06`, `12`).
- Đăng nhập nhanh demo = endpoint Better Auth `POST /api/auth/demo/quick-login` (403 khi tắt). Mã lỗi đăng nhập thứ 5 `EMAIL_NOT_VERIFIED`. Admin seed có mã `ADMIN`.
- Phiên bản: TypeScript 5.9, TypeORM 0.3.x (chưa lên TS 7 / TypeORM 1.x).

## 4. Câu hỏi còn mở (hỏi người dùng đúng lúc)

- Đã chốt Phase 4 (ghi `00`, `01`, `08`, `10`, `11`, `12`): trọng số + tham số dữ liệu chung ở `Rule` `RISK-SCORE`; `RuleTrigger.alertId` NULL + `evaluationRunId`; RiskScore cộng dồn, chỉ hiển thị; `INSUFFICIENT` = 0 nhóm; bỏ điều kiện hoàn tác "chưa có EvaluationRun"; trạng thái/lần học/kết quả theo `asOf` (`CourseResult.processPublishedAt`); 1 queue `evaluation-run`.
- **Phase 5**: chốt `Rule.cooldown` (đang tạm 168 giờ) và cách gộp trigger → Alert.
- **Phase 5**: khóa chống trùng Alert `(studentId, ruleCode, scopeId, termId)` trong khi `Alert` không có `ruleCode`/`scopeId` và gộp nhiều luật — cần thống nhất cách gộp. Sinh viên đổi lớp → chuyển Alert đang mở (đã ghi `09`).
- **Trước Phase 6**: Tremor 3 chỉ nhận React 18 → chọn lại thư viện biểu đồ.

## 5. Bẫy đã gặp — đừng lặp lại

1. **Viết file qua heredoc/`node -e` trong Git Bash**: chuỗi `\r\n`, `\uFEFF` trong template literal bị biến thành ký tự thật → hỏng regex/test. Dùng tool Write/Edit để tạo file có ký tự escape.
2. **Next.js production nhân bản module** giữa route handler và trang → 1 `DataSource` dùng chung gây `EntityMetadataNotFoundError`; đã sửa bằng cache theo class `User` của từng bản sao (`src/db/data-source.ts`). Lỗi chỉ lộ ra khi `next build`/Docker — luôn thử trong container.
3. **Không truyền instance entity xuống Client Component** (kể cả kết quả `repo.find({ select })`) — map sang object thuần; test `expectPlain()` kiểm prototype cho mọi hàm `list*`. Client chỉ `import type` DTO.
4. **Worker chạy ở máy**: `TaskStop` chỉ dừng tiến trình bọc `npx`, tiến trình `tsx` con vẫn chạy và tranh job. Kiểm tra/tắt bằng PowerShell: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? CommandLine -match 'src/workers'`. Khi chạy worker ở máy phải dừng container `worker` (và ngược lại).
5. **Docker build** đôi khi treo ở `npm ci` → dừng và build lại (lỗi mạng tạm thời).
6. **Browser pane**: cửa sổ bị che → không chụp màn hình được; dùng `get_page_text`/`javascript_tool`. Dialog Radix đã đóng vẫn nằm trong DOM → chọn `[role=dialog][data-state=open]`. Radix Select: phát `pointerdown` lên combobox rồi `pointerup` + `click` lên option.
7. **jsonb không giữ thứ tự khóa** → thứ tự cột gốc lưu riêng (`summary.columns`).
8. **papaparse stream chậm bậc hai** (bỏ, dùng `csv-parse`); **exceljs stream bỏ sót dữ liệu** (XLSX đọc cả file vào bộ nhớ, có trần).
9. Cột jsonb kiểu `Record<string, unknown>` làm `update()` báo lỗi kiểu → khai báo interface cụ thể (VD `ImportBatchSummary`).
10. Index có biểu thức (COALESCE) viết tay trong migration + `@Index(name, { synchronize: false })` để `migration:check` không đòi xóa.
11. Test tích hợp chạy với Postgres thật (+ MailHog cho test đăng ký). Dữ liệu test dùng tiền tố `TST`; dọn lô nhập có tên file `tst-%` — **đừng đặt tên file thử bằng tay bắt đầu bằng `tst-`**.
12. Dữ liệu người dùng tự tạo trong DB (GV02, CVHT0001, HK2_2026…) là dữ liệu thật của họ — không xóa/sửa khi dọn dữ liệu thử.
13. TypeORM sinh trùng `CREATE TYPE` khi nhiều bảng dùng chung 1 `enumName` (`severity`, `rule_status`) — xóa câu trùng trong migration vừa sinh TRƯỚC khi chạy. Cột jsonb cấu trúc thay đổi theo luật: khai báo `object` (kiểu JSON đệ quy làm TypeORM báo "excessively deep").
14. Comment `/** … */` chứa `ATT-*/LMS-*` bị đóng sớm bởi `*/`.

## 6. Việc tiếp theo: Phase 5

Theo `docs/implement.md` mục Phase 5, rule `06`, `07`, `11`. Trigger lưu theo `evaluationRunId`, `alertId` NULL — Phase 5 thêm bảng `alerts` + FK `rule_triggers.alert_id`, gộp trigger mỗi lần chạy vào Alert (bước 7–10 của `08`), xóa phần "Phase 5" ở `processEvaluationRun()` (`evaluation-run.service.ts`, đếm `alertsCreated/Updated`). Hỏi trước câu hỏi mở ở mục 4. Test nghiệm thu dùng `tests/integration/rule-engine-acceptance.test.ts` (học kỳ thử `TSTHK2_25`/`TSTHK1_26`).

## 7. Phong cách làm việc với người dùng

- Trả lời tiếng Việt, ngắn gọn, dễ hiểu; người dùng là sinh viên làm đồ án tốt nghiệp.
- Người dùng thích được **review kỹ như hội đồng chấm** trước khi code phase lớn, và muốn được hỏi bằng câu hỏi có lựa chọn (kèm đề xuất) cho mọi quyết định nghiệp vụ/danh mục thật — không tự bịa.
- Mọi quyết định mới → cập nhật file rule ngay và nói rõ đã đổi gì.
