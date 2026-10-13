# 08 — Business Rules Catalog (Rule Engine)

Xem `00-project-context.md` cho glossary/enum và `10-data-schema-source-records.md` cho 3 bảng dữ liệu nguồn. File này là nguồn sự thật cho logic trong `modules/rule-engine`. MUST NOT tự thêm luật hoặc điều kiện ngoài file này. Mọi ngưỡng là giá trị mặc định, MUST đọc từ `RuleVersion.condition`, KHÔNG hard-code.

## Bộ luật: 10 luật trên 3 nguồn dữ liệu

| Nhóm | Mã | Nguồn | Phạm vi (`Rule.scope`) |
|---|---|---|---|
| Điểm danh | `ATT-01`, `ATT-02`, `ATT-03` | `AttendanceSummary` | `PER_COURSE` |
| LMS | `LMS-01`, `LMS-02` | `LmsQuizAttempt` | `PER_COURSE` |
| Học lực | `ACA-01` | `CourseResult` (chỉ điểm quá trình) | `PER_COURSE` |
| Học lực | `ACA-02`, `ACA-03` | `CourseResult` (cuối kỳ) | `PER_STUDENT` |
| Kết hợp | `COMB-01`, `COMB-02` | Kết quả các luật trên | `PER_COURSE` |

`scopeId` = `courseId` khi `PER_COURSE`; = `studentId` khi `PER_STUDENT`. MUST NOT cài luật ngoài bảng này. Thêm luật: cập nhật file này trước, rồi thêm 1 file vào registry (xem `01-architecture.md`).

## Thời điểm tính và chống rò rỉ thời gian

Mỗi lần chạy có mốc `asOf` (lưu ở `EvaluationRun.asOf`), mặc định = thời điểm tạo `EvaluationRun`; khi `DEMO_MODE=true`, Admin được chọn `asOf` sớm hơn để chạy lại bộ dữ liệu demo có ngày cố định (ghi Audit Log). MUST chỉ dùng: snapshot điểm danh có `snapshotDate ≤ asOf`; lượt làm bài có `startedAt ≤ asOf`; kết quả học phần có `publishedAt ≤ asOf`. Trạng thái dẫn xuất cũng tính theo `asOf`, KHÔNG đọc trạng thái hiện tại trong DB: `attemptOutcome` / `COMPLETED` chỉ khi `CourseResult` `FINAL` có `publishedAt ≤ asOf`; `attemptNumber` = 1 + số học kỳ trước có kết quả FAILED đã công bố `≤ asOf` (tránh chạy lại mốc cũ sau khi đã nạp điểm cuối kỳ cho kết quả khác). `WITHDRAWN` là đánh dấu tay, dùng trạng thái hiện tại. Đơn vị đánh giá là 1 `Enrollment` (sinh viên × học phần × học kỳ); `ACA-02`/`ACA-03` gom theo sinh viên × học kỳ.

## Trình tự xử lý bắt buộc — 10 bước, không được đảo thứ tự

1. Loại dữ liệu `INVALID`.
2. Chỉ xét `Enrollment.enrollmentStatus = REGISTERED` (riêng `ACA-02`/`ACA-03` xét cả `COMPLETED` của học kỳ đang tính).
3. Áp dụng ngoại lệ (mục "Ngoại lệ") — MUST chạy TRƯỚC bước 4 và 6.
4. Xác định `DataStatus` từng nhóm (mục "DataStatus từng nhóm") và tính chỉ số thành phần.
5. Tính `RiskScore` (công thức ở `00-project-context.md`, chuẩn hóa ở mục "RiskScore").
6. Chạy `ATT-*`, `LMS-*`, `ACA-*`; sau đó chạy `COMB-01`, `COMB-02` trên kết quả vừa có của cùng `Enrollment`.
7. Gộp nguyên nhân theo khóa tương quan + cooldown (cuối file).
8. Severity của `Alert` = max(severity các `RuleTrigger`).
9. Tạo/cập nhật `Alert`.
10. Gửi thông báo theo `06-security.md`.

## Cách kích hoạt đánh giá — 2 đường, cùng 1 job

- Tự động: sau khi batch `ATTENDANCE_SUMMARY`, `LMS_QUIZ` hoặc `COURSE_RESULT` đạt `RECONCILED` → tạo `EvaluationRun` (`AUTO_AFTER_IMPORT`) cho học kỳ của batch.
- Thủ công: `ADMIN` bấm "Chạy đánh giá ngay", chọn học kỳ (tùy chọn học phần) → `EvaluationRun` (`MANUAL`).
- MUST: 2 đường dùng chung 1 job; chỉ dùng `RuleVersion` `ACTIVE`; chạy lại MUST NOT tạo `Alert` trùng.
- Chạy cho 1 học phần (`courseId`): luật `PER_COURSE` chỉ xét học phần đó; `ACA-02`/`ACA-03` vẫn tính đầy đủ cho các sinh viên có `Enrollment` của học phần đó.

## Tham số dữ liệu dùng chung — đặt trong `condition` của `RISK-SCORE` (1 nguồn, không lặp ở từng luật)

`{ weights: { attendance 0.4, lms 0.3, academic 0.3 }, attendance: { freshnessDays 14, denominator PLANNED, countExcused true, normalizer 0.2 }, lms: { participationThreshold 0.5, graceDays 3 }, academic: { passScore 5 } }`. `freshnessDays` quyết định `STALE` cho mọi `ATT-*`; `lms` định nghĩa "bài đến hạn" cho `LMS-01`, `LMS-02` và RiskScore. Ngưỡng riêng của từng luật nằm trong `condition` của luật đó (VD dải `ATT-01` dạng `{ percent, op: gte|gt, severity }`). Mốc `asOf` chọn theo ngày = hết ngày đó giờ Việt Nam (không vượt quá thời điểm hiện tại).

## DataStatus từng nhóm (bước 4)

- Điểm danh: `AVAILABLE` nếu có snapshot và `asOf − snapshotDate ≤ freshnessDays` (mặc định 14); `STALE` nếu cũ hơn; `MISSING` nếu chưa có; `INVALID` nếu tổng các cột trạng thái > `totalSessions`.
- LMS: `NOT_APPLICABLE` nếu học phần × học kỳ chưa có bài kiểm tra nào trong hệ thống (môn không dùng LMS); ngược lại `AVAILABLE` (sinh viên không có lượt làm là tín hiệu, KHÔNG phải `MISSING`).
- Học lực: `AVAILABLE` nếu có `CourseResult`; `MISSING` nếu chưa (bình thường ở đầu kỳ).

## RiskScore — chuẩn hóa từng thành phần về [0, 1]

- Điểm danh: `min(1, absenceRate / 0.20)` (0.20 đọc từ ngưỡng `CRITICAL` của `ATT-01`).
- LMS: số bài đến hạn bị bỏ / số bài đến hạn (0 nếu chưa có bài đến hạn).
- Học lực: `min(1, max(0, (5 − processScore) / 5))`, hoặc dùng `finalScore` nếu đã có.
- Trọng số mặc định 0.4 / 0.3 / 0.3, đọc từ cấu hình RiskScore = `RuleVersion` `ACTIVE` của `Rule` đặc biệt `RISK-SCORE` (`ruleGroup = RISK_SCORE`, `condition = { weights: { attendance, lms, academic } }`, mỗi trọng số ≥ 0, tổng > 0 — Zod). Dùng chung cơ chế phiên bản / chạy thử / kích hoạt / Audit Log với 10 luật; `RiskScoreLog.ruleVersionId` trỏ phiên bản này. `RISK-SCORE` KHÔNG nằm trong registry luật, KHÔNG tạo `RuleTrigger` (người dùng chọn, 2026-10-12: dễ trình diễn trước hội đồng — đổi trọng số → phiên bản mới → chạy thử → kích hoạt trên cùng màn hình cấu hình luật). Thành phần không `AVAILABLE` bị loại khỏi tử và mẫu.
- **Gộp nhiều học phần → 1 điểm/sinh viên/học kỳ** (người dùng chốt "cộng dồn số liệu"): điểm danh = Σ buổi vắng / Σ mẫu số `ATT-01` trên các `Enrollment` có điểm danh `AVAILABLE`; LMS = Σ bài đến hạn bị bỏ / Σ bài đến hạn trên các `Enrollment` LMS `AVAILABLE`; học lực = trung bình điểm (`finalScore` nếu có, không thì `processScore`) rồi chuẩn hóa như trên. Nhóm `AVAILABLE` khi ≥ 1 `Enrollment` của nhóm `AVAILABLE`; `NOT_APPLICABLE` khi mọi `Enrollment` đều `NOT_APPLICABLE`.
- RiskScore CHỈ để hiển thị và sắp xếp (danh sách CVHT, tổng quan) — KHÔNG tạo `RuleTrigger`/`Alert` (không có luật ngưỡng RiskScore trong bảng 10 luật).

## Nhóm điểm danh (nguồn: snapshot mới nhất của `Enrollment`)

**ATT-01 — Tỷ lệ vắng so với ngưỡng cấm thi**
Căn cứ quy chế (người dùng xác nhận): sinh viên nghỉ **vượt quá 20%** tổng số tiết của học phần (**cả có phép và không phép**) bị cấm dự thi và nhận điểm F. Hệ thống chỉ CẢNH BÁO — MUST NOT ghi điểm F hay trạng thái cấm thi.
`absenceRate = (unexcusedAbsence + excusedAbsence) / mẫu số`. Mẫu số theo `condition.denominator`: `PLANNED` (= `plannedSessions`, mặc định — đúng quy chế) hoặc `HELD` (= `totalSessions`); `plannedSessions` NULL → dùng `HELD` và ghi rõ trong `reason`.
Tính theo buổi; quy chế tính theo tiết — tương đương khi các buổi có cùng số tiết (giới hạn ghi ở cuối file). `condition`: `countExcused` (mặc định `true`), `lateToAbsenceRatio` (mặc định 0 = không quy đổi).
Dải: `≥ 0.10` → `MEDIUM`; `≥ 0.15` → `HIGH`; `> 0.20` → `CRITICAL` ("đã vượt ngưỡng cấm thi"). Đúng 20% là `HIGH`. MUST cài dạng nhánh, lấy dải cao nhất. MUST so sánh bằng số nguyên (VD: `absences × 100 > 20 × mẫu số`), KHÔNG so sánh số thực — các ca đúng ngưỡng (10%, 20%) phải ra kết quả ổn định.
Chỉ xét khi `totalSessions ≥ minSessions` (mặc định 4).

**ATT-02 — Vắng tăng nhanh**
So snapshot mới nhất S2 với snapshot liền trước S1 của cùng `Enrollment`, khi `S2.snapshotDate − S1.snapshotDate ≤ windowDays` (mặc định 14). `S2.unexcusedAbsence − S1.unexcusedAbsence ≥ 2` → `HIGH`.
Chênh lệch âm (dữ liệu bị sửa) → không kích hoạt, ghi cảnh báo chất lượng dữ liệu vào kết quả `EvaluationRun`. Chỉ có 1 snapshot → không xét.

**ATT-03 — Đi trễ nhiều**
`late ≥ 3` → `LOW` (chỉ hiển thị trong ứng dụng, không gửi email).

## Nhóm LMS (nguồn: `LmsQuizAttempt` của học phần × học kỳ)

Bài kiểm tra Q được coi là **đến hạn** khi đồng thời: (a) tỷ lệ sinh viên của nhóm có ≥1 lượt `SUBMITTED` cho Q ≥ `participationThreshold` (mặc định 0.5); (b) `asOf −` lượt làm đầu tiên của cả nhóm cho Q `≥ graceDays` (mặc định 3 ngày). "Nhóm" = các `Enrollment` của cùng học phần × học kỳ; nếu MỌI lượt làm bài LMS của học phần đó có `sectionCode` thì tách nhóm theo `sectionCode` của chính các lượt làm bài; sinh viên không có lượt nào lấy `sectionCode` từ snapshot điểm danh mới nhất (không có thì thuộc nhóm chung) — để không bỏ sót sinh viên bỏ MỌI bài.

**LMS-01 — Bỏ bài kiểm tra**
Đếm bài đến hạn mà sinh viên không có lượt `SUBMITTED`: 1 bài → `MEDIUM`; ≥ 2 bài → `HIGH`.

**LMS-02 — Điểm kiểm tra thấp**
Lấy 2 bài đến hạn gần nhất (theo lượt làm đầu tiên của nhóm) mà sinh viên đã nộp; điểm mỗi bài = lượt cao nhất `score / maxScore`. Lượt có `maxScore` NULL bị bỏ qua và ghi cảnh báo chất lượng dữ liệu vào `EvaluationRun`. Cả 2 bài `< 0.5` → `MEDIUM`. Chưa đủ 2 bài đã nộp → không xét.

## Nhóm học lực (nguồn: `CourseResult`)

**ACA-01 — Điểm quá trình thấp (trước kỳ thi)**
`resultStatus = PROCESS_ONLY` và `processScore < 5.0` → `HIGH`. Khi kết quả chuyển `FINAL`, luật này không xét nữa (trigger cũ giữ làm lịch sử).

**ACA-02 — Rớt học phần trong học kỳ** (`PER_STUDENT`)
Đếm `CourseResult` `FINAL` có `passed = false` trong học kỳ: 1 → `HIGH`; ≥ 2 → `CRITICAL`.

**ACA-03 — Điểm trung bình học kỳ thấp** (`PER_STUDENT`)
`GPA4 = Σ(gradePoint4 × credits) / Σ credits` trên các kết quả `FINAL` có `letterGrade` và `credits` khác NULL; `gradePoint4` do engine quy đổi từ `letterGrade` lúc đánh giá (KHÔNG lưu ở `CourseResult` — đổi thang không phải sửa dữ liệu cũ). Chỉ xét khi `Σ credits ≥ minCredits` (mặc định 6). `GPA4 < 2.0` → `HIGH`. So sánh bằng số nguyên theo nửa điểm: `Σ(2 × gradePoint4 × credits) < 4 × Σ credits` (thang có các mức x,5).
Quy đổi điểm chữ → hệ 4 đọc từ `condition.gradeScale` (người dùng xác nhận theo quy chế trường): A+ = 4 · A = 4 · B+ = 3,5 · B = 3 · C+ = 2,5 · C = 2 · D+ = 1,5 · D = 1 · F = 0. Điểm chữ chưa có trong `gradeScale` → bỏ qua kết quả đó và ghi cảnh báo chất lượng dữ liệu vào `EvaluationRun`.

## Nhóm kết hợp (chạy sau cùng, trên cùng `Enrollment`, cùng lần chạy)

**COMB-01 — Nhiều nguồn cùng xấu**
Có trigger mức ≥ `MEDIUM` ở ≥ 2 trong 3 nhóm: điểm danh (`ATT-01`/`ATT-02`), LMS (`LMS-01`/`LMS-02`), học lực (`ACA-01`) → `CRITICAL`.

**COMB-02 — Học lại vẫn sa sút**
`Enrollment.attemptNumber ≥ 2` (đã rớt học phần này ở học kỳ trước) VÀ có trigger `ATT-*`/`LMS-*` mức ≥ `MEDIUM` → tạo trigger với severity = mức cao nhất đang có + 1 bậc (tối đa `CRITICAL`). `reason` MUST nêu học kỳ đã rớt.

## Ngoại lệ — Bước 3, chặn TRƯỚC khi luật chạy

- `Enrollment.enrollmentStatus = WITHDRAWN` (Admin đánh dấu đã rút) → bỏ qua mọi luật của `Enrollment` đó. Đánh dấu/bỏ đánh dấu KHÔNG tự chạy đánh giá và không sửa `Alert` ngay; lần chạy kế tiếp xử lý theo luật gộp hiện có (người dùng chốt 2026-10-13).
- Học kỳ đã chốt (`Term.closedAt` khác NULL) → không tạo `EvaluationRun`.
- Điểm danh `STALE`/`INVALID`/`MISSING` → không chạy `ATT-*`.
- `totalSessions < minSessions` → không chạy `ATT-01` (tránh 1/2 buổi = 50% ở đầu kỳ).
- LMS `NOT_APPLICABLE` → không chạy `LMS-*`.

## Giới hạn đã biết — ghi vào báo cáo, MUST NOT tự "vá" bằng logic đoán

- Không biết bài kiểm tra mà chưa ai làm (không có danh sách bài từ LMS) → `LMS-01` chỉ bắt được bài đa số lớp đã làm.
- Điểm danh là số tổng hợp → không phát hiện "vắng liên tiếp" chính xác; `ATT-02` là xấp xỉ theo mức tăng giữa 2 lần nhập.
- Nguồn điểm danh đếm theo buổi, quy chế tính theo tiết → `ATT-01` chỉ chính xác khi các buổi của học phần có cùng số tiết.
- Không biết sinh viên rút học phần từ 3 nguồn → Admin đánh dấu tay.
- Không có danh sách đăng ký học phần: sinh viên không xuất hiện trong file nguồn nào của học phần thì hệ thống không biết sinh viên có học — phụ thuộc file điểm danh liệt kê đủ sinh viên.
- Nạp một phần (nhiều dòng LMS bị lỗi) làm lệch tỷ lệ "phần lớn lớp đã làm" của `LMS-01` → màn xem trước cảnh báo khi tỷ lệ lỗi > 10% (xem `12`).
- Mỗi `Enrollment` chỉ 1 dòng `CourseResult` (dòng `FINAL` ghi đè dòng giữa kỳ): engine dùng `CourseResult.processPublishedAt` để chạy lại mốc giữa kỳ vẫn thấy điểm quá trình; nếu file cuối kỳ SỬA điểm quá trình thì lần chạy lại mốc cũ thấy điểm đã sửa.

Cảnh báo nghi báo sai do các giới hạn này: CVHT dùng `DISMISSED` kèm lý do.

## Gộp nguyên nhân & chống trùng cảnh báo (Bước 7–9) — người dùng chốt 2026-10-13

- **Đơn vị gộp: 1 `Alert` / sinh viên / học kỳ** — gộp MỌI trigger (mọi luật, mọi học phần) của sinh viên trong học kỳ. "Dấu hiệu" = cặp `(ruleCode, scopeId)`; chi tiết cảnh báo nhóm dấu hiệu theo 3 nguồn. Tối đa 1 `Alert` CHƯA ĐÓNG / `(studentId, termId)` (partial unique index).
- Mỗi lần chạy có trigger của sinh viên: gắn trigger vào `Alert` của `(studentId, termId)`; `lastDetectedAt` = lúc chạy; `severity` = max severity các trigger của **lần chạy gần nhất** đã áp dụng.
  - Chưa có `Alert` → tạo `OPEN` (thông báo).
  - `Alert` đang mở (`OPEN`/`ACKNOWLEDGED`/`IN_PROGRESS`/`REOPENED`) → cập nhật; `severity` tăng → thông báo; giảm thì chỉ cập nhật.
  - `Alert` đã đóng (`RESOLVED`/`DISMISSED`) → **mở lại theo dấu hiệu, không theo thời gian**: có dấu hiệu MỚI (cặp `(ruleCode, scopeId)` chưa có trong cảnh báo) hoặc dấu hiệu cũ NẶNG HƠN mức đã ghi nhận → `REOPENED` (thông báo); dấu hiệu y hệt/nhẹ hơn → chỉ gắn trigger làm bằng chứng, không đổi trạng thái, không thông báo. `Rule.cooldown` (giờ) mặc định 0 = tắt; > 0 thì còn phải qua đủ số giờ kể từ lúc đóng mới được mở lại.
  - `Alert` `INVALIDATED` → không mở lại; dấu hiệu xuất hiện lại sau đó tạo `Alert` mới.
- Lần chạy có `asOf` CŨ hơn mốc dữ liệu đã áp dụng cho `Alert` (`Alert.lastAsOf`, VD chạy lại mốc quá khứ khi demo) → chỉ gắn trigger làm bằng chứng, MUST NOT đổi mức/trạng thái.
- Hoàn tác lô (xem `12`): lần chạy lại sau hoàn tác mà `Alert` đang mở không còn trigger nào → hệ thống chuyển `INVALIDATED` (`changedBy` NULL, lý do "dữ liệu nguồn đã được hoàn tác"). Ngoài trường hợp này hệ thống KHÔNG tự đóng cảnh báo — sinh viên cải thiện thì Cố vấn học tập chuyển `RESOLVED`.
- Job chạy lại (retry) MUST NOT tạo `Alert` hay thông báo trùng: unique index ở trên + `jobId` thông báo theo `(alertId, sự kiện, evaluationRunId)`.
