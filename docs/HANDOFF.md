# Bàn giao ngữ cảnh — CTUT-EWARS

> Đọc file này đầu tiên khi bắt đầu phiên mới. Cập nhật lần cuối: 2026-10-19 (sau Phase 8d).
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
| 6 Quản trị và vận hành | Xong | `phase-6` | #8 → `phase-5` | xanh |
| 7 Hoàn thiện và demo | Xong | `phase-7` | #9 → `main` | — |
| 8a Điều chỉnh theo dữ liệu thật (12 luật, demo v2) | Xong | `phase-8a` | #10 → `phase-7` | — |
| 8b Nền tảng giao diện (phân trang, thẻ điện thoại, Ctrl+K, menu nhóm) | Xong | `phase-8b` | #11 → `phase-8a` | — |
| 8c Trang quản trị (Bắt đầu, Tài khoản, Lớp, Kết quả đánh giá) | Xong | `phase-8c` | #12 → `phase-8b` | — |
| 8d Hai trang tổng quan (Admin + CVHT) | Xong | `phase-8d` (đang checkout) | → `phase-8c` | — |

- Repo: https://github.com/66trent/CTUT-Early-Warning-Academic-Risk-System — **đã merge #1–#8 vào `main` (merge commit, 2026-10-15)**. Từ Phase 7 PR đi thẳng vào `main`.
- Quy trình mỗi phase (người dùng đã đồng ý, làm liên tục từ Phase 0): code → `typecheck`, `lint`, `format:check`, `migration:check`, `test`, `build` → kiểm tra tay trên trình duyệt → tick `docs/implement.md` → ghi `PROGRESS.md` (≤15 dòng) → commit (kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`) → push → `gh pr create` (body kết thúc bằng `🤖 Generated with [Claude Code](https://claude.com/claude-code)`) → `bind_pr` → báo kết quả theo DoD + hướng dẫn tự kiểm tra.
- `gh` CLI đã cài và đăng nhập (tài khoản `66trent`). Trong Git Bash gọi bằng `"/c/Program Files/GitHub CLI/gh.exe"`.

## 2. Môi trường đang chạy

- Docker Compose (project `ewars`): `app` (3000), `worker`, `postgres` (5432), `redis` (6379), `minio` (9000/9001), `mailhog` (1025/8025, profile `dev`) — port chỉ mở `127.0.0.1`. Image app/worker đã build theo code Phase 7.
- Container dự án CŨ (`ctut-ewars-*`, ở `E:\CTUT-EWARS`) đã **dừng** (không xóa) để nhường port.
- `.env` (không commit): `STAFF_EMAIL_DOMAIN=@ctuet.edu.vn` (Phase 7 đặt lại); `AUTH_SECRET` sinh mới Phase 7; `DEMO_MODE=true`; có thêm `POSTGRES_USER/PASSWORD/DB` khớp `DATABASE_URL`. DB phụ `ewars_perf` (5.000 SV giả, đo hiệu năng).
- Dữ liệu trong DB dev: bộ demo chuẩn dựng bằng `npm run demo:reset -- --yes --evaluate` (2026-10-15) — GV001/GV002 mật khẩu = `DEMO_ADVISOR_PASSWORD`, 13 SV, 5 file, 2 mốc chính thức → đúng 12 cảnh báo. Có thể còn dữ liệu do `npm run screenshots` (chỉ đọc). Sao lưu cũ: `backups/before-phase6-dod-20261013.dump` (dữ liệu người dùng trước Phase 6), `before-phase7-migration-20261015.dump`, `ewars-*.dump`.
- Chạy app ở máy (khi cần thử giao diện): `docker compose stop app worker` → Browser pane `preview_start` tên `next-dev` (cổng 3000, `.claude/launch.json`) + worker bằng `npx tsx src/workers/index.ts` chạy nền. Xong thì tắt worker (xem bẫy #4) và `docker compose --profile dev up -d --build app worker`.

## 2b. Bản đồ code

- Dữ liệu: `src/db/entities/*` (22 entity), `src/db/migrations/*` (6 migration, đăng ký tay trong `src/db/data-source.ts`), enum dùng chung `src/db/enums.ts`, seed `src/db/seeds/{base,demo}-seed.ts` (seed luật gọi `seedRules` của rule-engine).
- `src/modules/data-import`: khung nhập 2 bước (`services/import-{batch,processor}.service.ts`), loại nhập trong `types/*.import.ts` + `registry.ts`, đọc file `parsing/*`, tự tạo Course/Enrollment + tính lần học `services/enrollment-sync.ts`.
- `src/modules/rule-engine`: evaluator thuần `evaluator/` (mỗi luật 1 file trong `rules/`, `engine.ts`, `facts.ts` theo asOf, `lms-groups.ts`, `risk-score.ts`, cấu hình chung `config.ts`), lần chạy `services/evaluation-run.service.ts` (lô 200 SV → gộp cảnh báo → thông báo), luật/phiên bản `services/rule-config.service.ts`, chạy thử `services/dry-run.service.ts`.
- `src/modules/alerts`: quyết định gộp/mở lại thuần `services/alert-decision.ts`, gộp vào DB `alert-sync.service.ts`, máy trạng thái + can thiệp + chuyển người phụ trách `alert-lifecycle.service.ts`, truy vấn `alert-query.service.ts`, hồ sơ/trang sinh viên `student-profile.service.ts`, thông báo `notification.service.ts`, Server Action `actions/alert.actions.ts`.
- Giao diện: `src/app/{admin,advisor,student}/**`, component `src/components/{alerts,evaluations,imports,admin,domain}/*`. Menu `src/components/layout/nav-config.ts`. Phase 6: `src/app/admin/{rules,audit-logs,getting-started,students}`, `/legal/privacy-policy`, component `src/components/{rules,admin}/*`, service `src/modules/admin/services/{overview,getting-started,setup-steps,audit-log,enrollment,student-search}*`, `rule-engine/services/rule-query.service.ts`, form luật tự sinh `rule-engine/condition-schema.ts` + `components/rules/condition-editor.tsx`, biểu đồ `components/ui/chart.tsx` (shadcn).
- Phase 7: dấu hiệu hiện tại `alerts/services/current-signals.ts` + gộp `alert-sync.service.ts` (giữ dấu hiệu điểm danh quá hạn), lịch đêm `SCHEDULED_EVALUATION_JOB`, bộ lọc Khoa `components/admin/department-filter.tsx`; script `scripts/{demo-reset,load-scenario,db-backup,perf-seed,perf-measure,screenshots}.ts`; kịch bản `docs/demo-data/kich-ban/*` (+ `tests/integration/demo-scenarios.test.ts`); Playwright `tests/e2e/*`; báo cáo `docs/bao-cao/*`.
- Worker: `src/workers/index.ts` + `processors/{import-batch,evaluation-run,notification}.processor.ts`; 3 queue ở `src/lib/queue/queues.ts`.
- Test: `tests/unit/**`, `tests/integration/**` (Postgres thật); helper dữ liệu demo `tests/helpers/demo-setup.ts`, `import-helpers.ts`, `evaluator-fixtures.ts`. Nghiệm thu: `rule-engine-acceptance.test.ts` (trigger), `alerts.test.ts` (cảnh báo).
- Lệnh thêm: `npm run demo:load` (nạp file demo 02–05 qua worker), `npm run templates:build` (sinh mẫu `.xlsx` từ `.csv`).

## 3. Quyết định đã chốt với người dùng (ngoài/đã ghi vào rules)

- Ngày trong `docs/demo-data` chuyển sang `YYYY-MM-DD` (Excel đã tự đổi sang kiểu Mỹ).
- Bỏ hoàn toàn chống gửi trùng / giới hạn tần suất thông báo; chỉ gửi khi Alert mới, REOPENED, hoặc tăng mức (`06`).
- Mã khoa Cơ khí chính thức: `K.KTCK` (không phải `K.CK`).
- Thang điểm 9 mức: A+ 9,5–10 · A 8,5–9,4 · B+ 8,0–8,4 · B 7,0–7,9 · C+ 6,5–6,9 · C 5,5–6,4 · D+ 5,0–5,4 · D 4,0–4,9 · F <4. Hệ 4 (sửa Phase 8a theo Quy chế 336): A+ 4 · **A 3,8** · B+ 3,5 · B 3 · C+ 2,5 · C 2 · D+ 1,5 · D 1 · F 0. `letterGrade` String(2); KHÔNG lưu `gradePoint4` — engine quy đổi lúc đánh giá; so sánh nửa điểm bằng số nguyên (`08`, `10`). Dữ liệu demo HK2 đã sửa theo thang này, danh sách cảnh báo mong đợi không đổi.
- Nhập dữ liệu: 2 bước (xem trước → xác nhận), nhận CSV + `.xlsx`, chia Phase 3 thành 3a/3b, hoàn tác lô **có điều kiện**, kiểm tra lại khi xác nhận, tự hủy lô chờ > 7 ngày, cảnh báo lỗi > 10%, khóa nạp theo (loại, học kỳ), ≤ 50.000 dòng, chống zip bomb, chống chèn công thức (`06`, `12`).
- Đăng nhập nhanh demo = endpoint Better Auth `POST /api/auth/demo/quick-login` (403 khi tắt). Mã lỗi đăng nhập thứ 5 `EMAIL_NOT_VERIFIED`. Admin seed có mã `ADMIN`.
- Phiên bản: TypeScript 5.9, TypeORM 0.3.x (chưa lên TS 7 / TypeORM 1.x).
- Tổng quan (chốt 2026-10-19, Phase 8d): xu hướng theo các lần đánh giá (mốc dữ liệu), không theo tuần lịch; "học phần chậm dữ liệu" so với ngày dữ liệu mới nhất của học kỳ, không so với hôm nay; CVHT: `/advisor` = tổng quan, danh sách cảnh báo `/advisor/alerts` (email + chuông đổi link, link cũ tự chuyển). DB `ewars_perf` đã tạo lại theo cấu trúc 8a (5.000 SV giả).
- Giao diện (chốt 2026-10-19, ghi `03`): họ tên sắp theo tên rồi họ; RiskScore hiển thị 0–1 (dấu phẩy) + thanh; danh mục khoa = chip lọc + mục thu gọn; giữ shadcn, chỉ thêm thành phần; kế hoạch giao diện chia 8b–8f.

## 4. Câu hỏi còn mở (hỏi người dùng đúng lúc)

- Đã chốt Phase 4 (ghi `00`, `01`, `08`, `10`, `11`, `12`): trọng số + tham số dữ liệu chung ở `Rule` `RISK-SCORE`; `RuleTrigger.alertId` NULL + `evaluationRunId`; RiskScore cộng dồn, chỉ hiển thị; `INSUFFICIENT` = 0 nhóm; bỏ điều kiện hoàn tác "chưa có EvaluationRun"; trạng thái/lần học/kết quả theo `asOf` (`CourseResult.processPublishedAt`); 1 queue `evaluation-run`.
- Đã chốt trước Phase 5 (2026-10-13, ghi `06`, `07`, `08`, `11`, `KET_QUA_MONG_DOI.md`, `implement.md`): 1 Alert / sinh viên / học kỳ; mở lại theo dấu hiệu mới/nặng hơn, `cooldown` mặc định 0; sinh viên chỉ thấy cảnh báo sau khi Cố vấn học tập xác nhận, không nhận email; đăng nhập nhanh demo thêm `KTPM2311003`, `KTPM2311001`. Mặc định đề xuất (người dùng không phản đối): `assignedAdvisorId` NULL được, `Notification.readAt`, bảng chuyển trạng thái, `RESOLVED` bắt buộc có can thiệp, `Intervention.status` DONE/FOLLOW_UP, Admin xem hồ sơ ghi Audit Log, lần chạy mốc cũ chỉ thêm bằng chứng, CHECK `isReferenceOnly`.
- Đã chốt trước Phase 6 (2026-10-13, ghi `00`, `03`, `04`, `05`, `07`, `08`, `09`, `11`, `implement.md`): biểu đồ Recharts + shadcn `Chart`; ẩn danh hóa HOÃN (người dùng bỏ khỏi Phase 6, bổ sung khi cần); trang chính sách đọc biến môi trường `PRIVACY_*`, thiếu → `[Cần nhà trường xác nhận]`; `WITHDRAWN` đánh dấu ở hồ sơ SV, bỏ được, không tự chạy đánh giá; dry-run so sánh với bản ACTIVE + danh sách thêm/bớt ≤ 50; Audit Log lọc thời gian/hành động/người/đối tượng. **DoD từ DB rỗng: người dùng chọn backup rồi xóa DB dev hiện tại** (`pg_dump` vào `backups/` trước, hỏi xác nhận lần cuối trước khi xóa).

- Đã chốt trước Phase 7 (2026-10-15, ghi `01`, `05`, `06`, `07`, `08`, `implement.md`): KHÔNG chạy theo Khoa, chỉ thêm bộ lọc Khoa; chạy theo học phần chỉ được tăng mức; hết dấu hiệu → giữ cảnh báo + nhãn "không còn dấu hiệu"; lịch chạy mỗi đêm (`SCHEDULED`, không nút bật/tắt); TLS = yêu cầu triển khai (README); hiệu năng đo trên DB `ewars_perf`; keyset chỉ khi > 300ms; backup = script chạy tay + diễn tập; Playwright 2 luồng, không vào CI; sinh viên demo bằng đăng nhập nhanh; đặt lại `STAFF_EMAIL_DOMAIN=@ctuet.edu.vn`; giữ "[Cần nhà trường xác nhận]"; ghi lý do trọng số vào `08`; agent sinh `AUTH_SECRET` mới; ẩn danh hóa vẫn hoãn. Kịch bản demo: 1 kịch bản chính 10 phút + nhiều kịch bản nhỏ (`docs/demo-data/kich-ban/NN-ten/`, dùng chung lớp/CVHT, dải MSSV riêng, mỗi kịch bản 1 test nghiệm thu), phủ MỌI tình huống hệ thống làm được; kịch bản nhỏ dùng để trả lời câu hỏi hội đồng. Đã merge #1–#8 vào `main` (merge commit); `phase-7` tạo từ `main`. Chốt thêm trong Phase 7: dữ liệu quá hạn ≠ hết dấu hiệu (`Alert.currentTriggerIds`, giữ dấu hiệu điểm danh học phần quá hạn); `DEMO_MODE=true` tắt lịch đêm VÀ không tự chạy sau nạp (vẫn tự chạy lại sau hoàn tác).

- **Đối soát dữ liệu thật của trường (2026-10-18) — `docs/doi-soat-du-lieu-truong.md`**: chốt A = 3,8 (quy chế 336, trước đây ghi nhầm 4,0); ACA-01/02/03 theo Điều 11 (ACA-01 = không đạt học phần, chỉ nạp kết quả khi học phần đã khóa điểm, bỏ `PROCESS_ONLY`); thêm LMS-03 (không nộp bài thực hành) + LMS-04 (nộp trễ), `han_nop` là cột trong file; điểm danh theo tiết, bỏ ATT-03; thêm ACA-04 sa sút qua học kỳ (không có dữ liệu HK trước → không xét); 1 năm = 3 học kỳ chính, không có hè; HK đầu khóa = `HK1_{cohortYear}` của lớp sinh hoạt (không thêm cột ở file sinh viên); 3 file học tập thêm `ho_dem`, `ten` tùy chọn để đối chiếu (không lưu); mã học phần = mã lớp học phần bỏ 2 số cuối (giả định, cho điền riêng); KHÔNG có file Excel thật — mẫu thiết kế theo ảnh. Tổng 12 luật. Bộ luật dễ hiểu + mẫu cột: mục 6, 6b của file đối soát. ĐÃ làm xong ở Phase 8a (2026-10-19). Review trước code (mục 9 file đối soát) chốt thêm: sao lưu rồi làm sạch dữ liệu học tập/cảnh báo/luật (giữ tài khoản, lớp, sinh viên, học kỳ); chốt học kỳ = liệt kê SV thiếu kết quả → chạy lần cuối → `closedAt`; RiskScore học lực giữa kỳ = ĐTB HK trước; chia Phase 8a (luật + dữ liệu) / 8b (giao diện + nạp nhiều file) / 9 (mở rộng dữ liệu) — đã ghi `docs/implement.md`. Dữ liệu demo v2 giai đoạn 1: K.CNTT, lớp KTPM2411, 3 môn (chính: Logic học `010100240802`), 1 học kỳ, ~20 SV, MSSV giả `KTPM2411901`–`920`; demo cũ lưu trữ ở `docs/demo-data/_luu-tru-v1/`. Form nạp: học kỳ + loại (bắt buộc), học phần tùy chọn (mặc định tự nhận diện, chọn thì lệch → `COURSE_MISMATCH`), không chọn khoa/lớp; thẻ nhận diện học phần/lớp/khoa/số SV ở màn xem trước — làm trong 8a.

## 5. Bẫy đã gặp — đừng lặp lại

0. **Docker Desktop tự khởi động lại container `app`/`worker` image CŨ** (cổng 3000 bị chiếm, worker cũ tranh job): khi chạy app ở máy luôn `docker compose stop app worker` trước. `next build` khi dev server đang chạy làm hỏng cache dev → khởi động lại dev server. Docker lỗi "Inference manager" = file kẹt `%LOCALAPPDATA%\Docker
un\dockerInference` → tắt Docker, xóa file, `wsl --shutdown`, mở lại (KHÔNG bấm Reset to factory defaults).

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
20. Script dùng hàng đợi BullMQ (`requestEvaluation`) giữ kết nối Redis → tiến trình không tự thoát: kết thúc bằng `process.exit()` (`demo-reset.ts`, `load-scenario.ts`).
21. Đăng nhập nhanh lặp nhiều lần (Playwright/script) chạm giới hạn tần suất → đăng nhập 1 lần / tài khoản rồi dùng lại `storageState` (`scripts/screenshots.ts`).
22. Biểu đồ Recharts trong lưới CSS tràn ngang trên điện thoại nếu ô lưới thiếu `min-w-0`.

23. `npx shadcn add` nhiều thành phần cùng lúc treo ở câu hỏi ghi đè thứ 2 (stdin `n` chỉ trả lời câu đầu) → thành phần chưa sinh viết tay theo mẫu shadcn; luôn sửa `from "cn"` → `@/lib/utils`.
24. TypeORM QueryBuilder lưu ORDER BY theo tên cột: `orderBy(x).addOrderBy(x)` GHI ĐÈ hướng của x (sắp giảm thành tăng); `find({ order })` cũng vậy. Dùng `applyOrder`/`findOrder` (`src/lib/list-params.ts`). Join 1–1 + sắp theo cột bảng join → dùng `offset/limit` thay `skip/take`.
25. Next 16 tách thư mục dev (`.next/dev`) — `next build` chạy song song dev server không còn làm hỏng cache (bẫy #0 cũ). Dev server của phiên khác chiếm cổng 3000 → Browser pane mở thẳng `http://localhost:3000` dùng chung.
26. `listX(filter, firstPage({ size }))` trong test/script truyền `sort: null, dir: asc` → service phải dùng `resolveSort` để lấy cả hướng mặc định (VD mức cao nhất giảm dần), nếu không sẽ ra tăng dần.
27. Python `io.open(..., "w")` trên Windows đôi khi lỗi `OSError [Errno 22]` khi dev server/prettier đang giữ file → ghi lại bằng tool Edit.

## 6. Việc tiếp theo

Phase 8a–8d xong (chờ merge PR). Tiếp: Phase 8e–8f (8b–8d đã làm) (chốt 2026-10-19, chi tiết `docs/implement.md`; giữ shadcn + thêm thành phần): 8b nền tảng giao diện (phân trang, thẻ trên điện thoại, tải/lỗi/trống, menu nhóm, Ctrl+K), 8c trang quản trị (Bắt đầu, Tài khoản, Lớp, Kết quả đánh giá), 8d hai trang tổng quan Admin + CVHT (`/advisor` thành tổng quan, cảnh báo sang `/advisor/alerts`), 8e CVHT + sinh viên (xuất Excel, trang thông báo, ma trận, hồ sơ), 8f nạp nhiều file + Playwright/ảnh/demo-script, Phase 9 (mở rộng dữ liệu demo, kịch bản nhỏ). Image Docker app/worker CHƯA build lại theo code 8a. Việc có thể làm khi người dùng yêu cầu: ẩn danh hóa sinh viên (hoãn), viết báo cáo đồ án (số liệu ở `docs/bao-cao/`, ảnh ở `docs/screenshots/`), triển khai thật (README mục 4). Lưu ý: chạy `npm test` liên tiếp < 1 phút có thể đỏ test đăng nhập do giới hạn 5 lần/phút. Trước buổi bảo vệ: `npm run demo:reset -- --yes` rồi theo `docs/demo-script.md`.

**Báo cáo tiến độ với giảng viên:** `docs/BAO_CAO_TIEN_DO.md` (checklist A–G + nhật ký báo cáo). Mỗi khi người dùng hỏi "báo cáo tiến độ" hoặc xong một việc trong danh sách: tick `[x]` kèm ngày, cập nhật bảng Tổng hợp (đếm lại), thêm 1 dòng Nhật ký báo cáo — không xóa mục cũ. Báo cáo Word cho hội đồng: `docs/bao-cao/Bao-cao-do-an-CTUT-EWARS.docx` (bìa "Đồ án Kỹ thuật phần mềm 3" — người dùng chốt), bản kỹ thuật: `docs/bao-cao/CTUT-EWARS_Bao-cao-yeu-cau-va-thiet-ke-ky-thuat.docx` (cả 2 chưa commit).

## 6b. Mở đầu phiên mới

Người dùng chỉ cần gõ: **"Đọc docs/HANDOFF.md, kiểm tra lại trạng thái PR trên GitHub, rồi cho biết trạng thái và việc còn lại"**. Agent: kiểm `gh pr list`, `git status`, `docker compose ps` trước; nếu người dùng đã merge PR thì tạo nhánh từ nhánh mới nhất còn lại.

## 7. Phong cách làm việc với người dùng

- Trả lời tiếng Việt, ngắn gọn, dễ hiểu; người dùng là sinh viên làm đồ án tốt nghiệp.
- Người dùng thích được **review kỹ như hội đồng chấm** trước khi code phase lớn, và muốn được hỏi bằng câu hỏi có lựa chọn (kèm đề xuất) cho mọi quyết định nghiệp vụ/danh mục thật — không tự bịa.
- Mọi quyết định mới → cập nhật file rule ngay và nói rõ đã đổi gì.
