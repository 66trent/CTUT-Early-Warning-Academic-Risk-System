# Bàn giao ngữ cảnh — CTUT-EWARS

> Đọc file này đầu tiên khi bắt đầu phiên mới. Cập nhật lần cuối: 2026-10-13 (sau Phase 6).
> Nguồn sự thật nghiệp vụ/kỹ thuật vẫn là `CLAUDE.md` + `docs/rules/00–12`; file này chỉ ghi **trạng thái, quyết định đã chốt với người dùng, và bẫy đã gặp** — những thứ không đọc được từ code.

## 1. Trạng thái

| Phase | Trạng thái | Nhánh | PR | CI |
|---|---|---|---|---|
| 0 Hạ tầng | Xong, đạt DoD | `phase-0` | #1 → `main` | xanh |
| 1 Xác thực, danh tính | Xong | `phase-1` | #2 → `phase-0` | xanh |
| 2 Danh mục quản trị | Xong (mục sĩ số đã kiểm ở 3a) | `phase-2` | #3 → `phase-1` | xanh |
| 3a Khung nhập + sinh viên | Xong | `phase-3a` | #4 → `phase-2` | xanh |
| 3b Nhập 3 nguồn học tập | Xong | `phase-3b` | #5 → `phase-3a` | xanh |
| 4 Rule engine (+ sửa lỗi font/mẫu Excel của Phase 3) | Xong | `phase-4` | #6 → `phase-3b` | xanh |
| 5 Cảnh báo, CVHT, sinh viên | Xong | `phase-5` | #7 → `phase-4` | xanh |
| 6 Quản trị và vận hành | Xong | `phase-6` (đang checkout) | #8 → `phase-5` | — |
| **7 Hoàn thiện và demo** | **Việc tiếp theo** | tạo `phase-7` từ `phase-6` | base `phase-6` | — |

- Repo: https://github.com/66trent/CTUT-Early-Warning-Academic-Risk-System — **PR xếp chồng, CHƯA merge** (kiểm lại 2026-10-13: cả 7 PR OPEN, CI xanh; cây làm việc sạch, HEAD `phase-5`). Người dùng merge theo thứ tự #1 → #2 → #3 → #4 → #5 → #6 → #7 (GitHub tự đổi base).
- Quy trình mỗi phase (người dùng đã đồng ý, làm liên tục từ Phase 0): code → `typecheck`, `lint`, `format:check`, `migration:check`, `test`, `build` → kiểm tra tay trên trình duyệt → tick `docs/implement.md` → ghi `PROGRESS.md` (≤15 dòng) → commit (kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`) → push → `gh pr create` (body kết thúc bằng `🤖 Generated with [Claude Code](https://claude.com/claude-code)`) → `bind_pr` → báo kết quả theo DoD + hướng dẫn tự kiểm tra.
- `gh` CLI đã cài và đăng nhập (tài khoản `66trent`). Trong Git Bash gọi bằng `"/c/Program Files/GitHub CLI/gh.exe"`.

## 2. Môi trường đang chạy

- Docker Compose (project `ewars`): `app` (3000), `worker`, `postgres` (5432), `redis` (6379), `minio` (9000/9001), `mailhog` (1025/8025, profile `dev`) — port chỉ mở `127.0.0.1`. Image app/worker đã build theo code Phase 6.
- Container dự án CŨ (`ctut-ewars-*`, ở `E:\CTUT-EWARS`) đã **dừng** (không xóa) để nhường port.
- `.env` (không commit): `STAFF_EMAIL_DOMAIN=*` (tạm thời, người dùng chưa có email trường — phải đặt lại `@ctuet.edu.vn` khi triển khai thật); `DEMO_MODE=true`; có thêm `POSTGRES_USER/PASSWORD/DB` khớp `DATABASE_URL`. Better Auth cảnh báo `AUTH_SECRET` độ ngẫu nhiên thấp — đã nhắc người dùng thay.
- Dữ liệu trong DB dev (KHÔNG tự xóa/sửa): **đã xóa sạch và làm lại từ đầu qua giao diện khi kiểm DoD Phase 6 (2026-10-13, người dùng đồng ý)**. Dữ liệu cũ (GV02, CVHT0001, HK2_2026, cảnh báo đã xử lý…) nằm trong `backups/before-phase6-dod-20261013.dump` (khôi phục: `pg_restore --clean`). Hiện có:
  - Tài khoản: `ADMIN` (seed), `GV001`/`GV002` (đăng ký qua form + xác minh MailHog + Admin duyệt; mật khẩu thử KHÔNG phải `DEMO_ADVISOR_PASSWORD` — người dùng đăng nhập bằng nút đăng nhập nhanh demo hoặc đặt lại qua `seed:demo`).
  - Học kỳ `HK2_2025`, `HK1_2026` (hiện tại); lớp `KTPM2311` (GV001), `KHMT2311` (GV002); 13 sinh viên; đã nạp 5 file demo; đã chạy HK2 mốc 15/06 + HK1 mốc 10/10 → 12 cảnh báo `OPEN`.
  - Backup cũ hơn: `backups/before-demo-reset-20261012.dump`.
- Chạy app ở máy (khi cần thử giao diện): `docker compose stop app worker` → Browser pane `preview_start` tên `next-dev` (cổng 3000, `.claude/launch.json`) + worker bằng `npx tsx src/workers/index.ts` chạy nền. Xong thì tắt worker (xem bẫy #4) và `docker compose --profile dev up -d --build app worker`.

## 2b. Bản đồ code (đã có đến Phase 5)

- Dữ liệu: `src/db/entities/*` (22 entity), `src/db/migrations/*` (6 migration, đăng ký tay trong `src/db/data-source.ts`), enum dùng chung `src/db/enums.ts`, seed `src/db/seeds/{base,demo}-seed.ts` (seed luật gọi `seedRules` của rule-engine).
- `src/modules/data-import`: khung nhập 2 bước (`services/import-{batch,processor}.service.ts`), loại nhập trong `types/*.import.ts` + `registry.ts`, đọc file `parsing/*`, tự tạo Course/Enrollment + tính lần học `services/enrollment-sync.ts`.
- `src/modules/rule-engine`: evaluator thuần `evaluator/` (mỗi luật 1 file trong `rules/`, `engine.ts`, `facts.ts` theo asOf, `lms-groups.ts`, `risk-score.ts`, cấu hình chung `config.ts`), lần chạy `services/evaluation-run.service.ts` (lô 200 SV → gộp cảnh báo → thông báo), luật/phiên bản `services/rule-config.service.ts`, chạy thử `services/dry-run.service.ts`.
- `src/modules/alerts`: quyết định gộp/mở lại thuần `services/alert-decision.ts`, gộp vào DB `alert-sync.service.ts`, máy trạng thái + can thiệp + chuyển người phụ trách `alert-lifecycle.service.ts`, truy vấn `alert-query.service.ts`, hồ sơ/trang sinh viên `student-profile.service.ts`, thông báo `notification.service.ts`, Server Action `actions/alert.actions.ts`.
- Giao diện: `src/app/{admin,advisor,student}/**`, component `src/components/{alerts,evaluations,imports,admin,domain}/*`. Menu `src/components/layout/nav-config.ts`. Phase 6: `src/app/admin/{rules,audit-logs,getting-started,students}`, `/legal/privacy-policy`, component `src/components/{rules,admin}/*`, service `src/modules/admin/services/{overview,getting-started,setup-steps,audit-log,enrollment,student-search}*`, `rule-engine/services/rule-query.service.ts`, form luật tự sinh `rule-engine/condition-schema.ts` + `components/rules/condition-editor.tsx`, biểu đồ `components/ui/chart.tsx` (shadcn).
- Worker: `src/workers/index.ts` + `processors/{import-batch,evaluation-run,notification}.processor.ts`; 3 queue ở `src/lib/queue/queues.ts`.
- Test: `tests/unit/**`, `tests/integration/**` (Postgres thật); helper dữ liệu demo `tests/helpers/demo-setup.ts`, `import-helpers.ts`, `evaluator-fixtures.ts`. Nghiệm thu: `rule-engine-acceptance.test.ts` (trigger), `alerts.test.ts` (cảnh báo).
- Lệnh thêm: `npm run demo:load` (nạp file demo 02–05 qua worker), `npm run templates:build` (sinh mẫu `.xlsx` từ `.csv`).

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
- Đã chốt trước Phase 5 (2026-10-13, ghi `06`, `07`, `08`, `11`, `KET_QUA_MONG_DOI.md`, `implement.md`): 1 Alert / sinh viên / học kỳ; mở lại theo dấu hiệu mới/nặng hơn, `cooldown` mặc định 0; sinh viên chỉ thấy cảnh báo sau khi Cố vấn học tập xác nhận, không nhận email; đăng nhập nhanh demo thêm `KTPM2311003`, `KTPM2311001`. Mặc định đề xuất (người dùng không phản đối): `assignedAdvisorId` NULL được, `Notification.readAt`, bảng chuyển trạng thái, `RESOLVED` bắt buộc có can thiệp, `Intervention.status` DONE/FOLLOW_UP, Admin xem hồ sơ ghi Audit Log, lần chạy mốc cũ chỉ thêm bằng chứng, CHECK `isReferenceOnly`.
- Đã chốt trước Phase 6 (2026-10-13, ghi `00`, `03`, `04`, `05`, `07`, `08`, `09`, `11`, `implement.md`): biểu đồ Recharts + shadcn `Chart`; ẩn danh hóa HOÃN (người dùng bỏ khỏi Phase 6, bổ sung khi cần); trang chính sách đọc biến môi trường `PRIVACY_*`, thiếu → `[Cần nhà trường xác nhận]`; `WITHDRAWN` đánh dấu ở hồ sơ SV, bỏ được, không tự chạy đánh giá; dry-run so sánh với bản ACTIVE + danh sách thêm/bớt ≤ 50; Audit Log lọc thời gian/hành động/người/đối tượng. **DoD từ DB rỗng: người dùng chọn backup rồi xóa DB dev hiện tại** (`pg_dump` vào `backups/` trước, hỏi xác nhận lần cuối trước khi xóa).

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
15. **Đừng xóa file migration trước khi `migration:revert` chạy xong** — `data-source.ts` import file đó, revert sẽ lỗi; đã phải gỡ tay bảng (Phase 5). Đúng thứ tự: revert → xóa file → bỏ import → generate lại.
16. Heredoc trong Bash tool hay lỗi "unexpected EOF" khi nội dung có dấu nháy/backtick lồng nhau → viết file bằng tool Write (hoặc script Python ở scratchpad).
17. Test tích hợp gọi `processEvaluationRun(runId, noEnqueue)` — mặc định đẩy email vào Redis thật, worker Docker sẽ xử lý job của dữ liệu thử.
18. `npx shadcn add <component>` hỏi ghi đè file có sẵn (trả lời `n`) và có thể sinh import sai (`chart.tsx` ra `from 'cn'`) — kiểm lại import + chạy prettier/lint sau khi thêm.
19. Browser pane bị che: `computer` click lỗi "not on screen" → thao tác bằng `javascript_tool` (Radix Select như bẫy #6, tải file lên bằng `DataTransfer` gán vào `input[type=file]`); điều hướng đầy đủ làm mất biến `window.*` → bấm link ở thanh bên (điều hướng phía client) để giữ hàm trợ giúp.

## 6. Việc tiếp theo: Phase 7

Theo `docs/implement.md` mục Phase 7 (bảo mật `06`, hiệu năng `05`, backup/restore, responsive + dark mode, kịch bản demo). Ẩn danh hóa sinh viên vẫn HOÃN — chỉ làm khi người dùng yêu cầu. Lưu ý: chạy `npm test` liên tiếp < 1 phút có thể đỏ test đăng nhập do giới hạn 5 lần/phút.

## 6b. Mở đầu phiên mới

Người dùng chỉ cần gõ: **"Đọc docs/HANDOFF.md, kiểm tra lại trạng thái PR trên GitHub, rồi làm rõ Phase 7 và hỏi tôi các quyết định cần chốt"** (hoặc "Thực hiện Phase 7" nếu đã chốt). Agent: kiểm `gh pr list`, `git status`, `docker compose ps` trước; nếu người dùng đã merge PR thì tạo nhánh từ nhánh mới nhất còn lại.

## 7. Phong cách làm việc với người dùng

- Trả lời tiếng Việt, ngắn gọn, dễ hiểu; người dùng là sinh viên làm đồ án tốt nghiệp.
- Người dùng thích được **review kỹ như hội đồng chấm** trước khi code phase lớn, và muốn được hỏi bằng câu hỏi có lựa chọn (kèm đề xuất) cho mọi quyết định nghiệp vụ/danh mục thật — không tự bịa.
- Mọi quyết định mới → cập nhật file rule ngay và nói rõ đã đổi gì.
