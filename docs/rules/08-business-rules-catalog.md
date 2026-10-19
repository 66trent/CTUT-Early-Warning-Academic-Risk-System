# 08 — Business Rules Catalog (Rule Engine)

Xem `00-project-context.md` cho glossary/enum và `10-data-schema-source-records.md` cho bảng dữ liệu nguồn. File này là nguồn sự thật cho logic trong `modules/rule-engine`. MUST NOT tự thêm luật hoặc điều kiện ngoài file này. Mọi ngưỡng là giá trị mặc định, MUST đọc từ `RuleVersion.condition`, KHÔNG hard-code.

Phiên bản 2 (Phase 8a, chốt 2026-10-18 — đối soát dữ liệu thật của trường + Quy chế đào tạo 336/QĐ-ĐHKTCN, xem `docs/doi-soat-du-lieu-truong.md`). Thay đổi so với bản 1: điểm danh theo TIẾT, bỏ `ATT-03` (đi trễ — trường không có dữ liệu); LMS tách bài trắc nghiệm / bài thực hành (thêm `LMS-03`, `LMS-04`); kết quả học tập chỉ nạp khi học phần đã khóa điểm (bỏ điểm quá trình giữa kỳ) — `ACA-01` đổi nghĩa thành "không đạt học phần", `ACA-02` theo % tín chỉ, `ACA-03` thêm mức quy chế, thêm `ACA-04`; A = 3,8.

**Hai loại ngưỡng** — ghi rõ trong báo cáo: (1) ngưỡng QUY CHẾ (vắng > 20% bị cấm thi; tín chỉ không đạt > 50%; ĐTB học kỳ < 1,0, học kỳ đầu khóa < 0,8 — Điều 11); (2) ngưỡng BÁO SỚM do nhóm đề xuất, CHƯA hiệu chỉnh bằng dữ liệu thật (10%, 15%, 25%, ĐTB < 2,0, giảm ≥ 1,0…). Admin đổi được cả hai qua phiên bản luật. Lời văn mức quy chế: "chạm ngưỡng … theo quy chế — tham khảo", KHÔNG phải quyết định học vụ.

## Bộ luật: 12 luật trên 4 nguồn dữ liệu

| Nhóm | Mã | Nguồn | Phạm vi (`Rule.scope`) | Xét `Enrollment` |
|---|---|---|---|---|
| Điểm danh | `ATT-01`, `ATT-02` | `AttendanceSummary` | `PER_COURSE` | `REGISTERED` |
| LMS — trắc nghiệm | `LMS-01`, `LMS-02` | `LmsActivity` (QUIZ) + `LmsQuizAttempt` | `PER_COURSE` | `REGISTERED` |
| LMS — thực hành | `LMS-03`, `LMS-04` | `LmsActivity` (ASSIGNMENT) + `LmsAssignmentSubmission` | `PER_COURSE` | `REGISTERED` |
| Học lực | `ACA-01` | `CourseResult` | `PER_COURSE` | `COMPLETED` |
| Học lực | `ACA-02`, `ACA-03`, `ACA-04` | `CourseResult` của học kỳ (+ học kỳ liền trước cho `ACA-04`) | `PER_STUDENT` | mọi trạng thái trừ `WITHDRAWN` |
| Kết hợp | `COMB-01`, `COMB-02` | Kết quả các luật trên | `PER_COURSE` | `REGISTERED` |

`scopeId` = `courseId` khi `PER_COURSE`; = `studentId` khi `PER_STUDENT`. MUST NOT cài luật ngoài bảng này. Thêm luật: cập nhật file này trước, rồi thêm 1 file vào registry (xem `01-architecture.md`).

## Thời điểm tính và chống rò rỉ thời gian

Mỗi lần chạy có mốc `asOf` (lưu ở `EvaluationRun.asOf`), mặc định = thời điểm tạo `EvaluationRun`; khi `DEMO_MODE=true`, Admin được chọn `asOf` sớm hơn (ghi Audit Log). MUST chỉ dùng: snapshot điểm danh có `snapshotDate ≤ asOf`; lượt làm bài có `startedAt ≤ asOf`; bài nộp có `submittedAt ≤ asOf`; kết quả học phần có `publishedAt ≤ asOf`. Trạng thái dẫn xuất tính theo `asOf`, KHÔNG đọc trạng thái hiện tại trong DB: `COMPLETED` khi có `CourseResult` `publishedAt ≤ asOf`; lần học = 1 + số học kỳ trước có kết quả không đạt đã công bố `≤ asOf`. `WITHDRAWN` là đánh dấu tay, dùng trạng thái hiện tại. Đơn vị đánh giá là 1 `Enrollment`; `ACA-02/03/04` gom theo sinh viên × học kỳ.

## Trình tự xử lý bắt buộc — 10 bước, không được đảo thứ tự

1. Loại dữ liệu `INVALID`.
2. Xác định trạng thái `Enrollment` tại `asOf` (cột "Xét `Enrollment`" ở bảng trên).
3. Áp dụng ngoại lệ (mục "Ngoại lệ") — MUST chạy TRƯỚC bước 4 và 6.
4. Xác định `DataStatus` từng nhóm và tính chỉ số thành phần.
5. Tính `RiskScore` (công thức ở `00`, chuẩn hóa ở mục "RiskScore").
6. Chạy `ATT-*`, `LMS-*`, `ACA-01`; rồi `COMB-01`, `COMB-02` trên kết quả vừa có của cùng `Enrollment`; rồi `ACA-02`, `ACA-03`, `ACA-04`.
7. Gộp nguyên nhân theo khóa tương quan (cuối file).
8. Severity của `Alert` = max(severity các dấu hiệu hiện tại).
9. Tạo/cập nhật `Alert`.
10. Gửi thông báo theo `06-security.md`.

## Cách kích hoạt đánh giá

- Tự động: sau khi lô `ATTENDANCE_SUMMARY`, `LMS_QUIZ`, `LMS_ASSIGNMENT` hoặc `COURSE_RESULT` đạt `RECONCILED` → `EvaluationRun` (`AUTO_AFTER_IMPORT`) cho học kỳ của lô. `DEMO_MODE=true`: KHÔNG tự chạy sau nạp; chạy lại sau hoàn tác lô vẫn tự chạy.
- Thủ công: `ADMIN` bấm "Chạy đánh giá ngay", chọn học kỳ (tùy chọn học phần) → `MANUAL`.
- Theo lịch: mỗi đêm cả học kỳ hiện tại → `SCHEDULED` (xem `05`).
- **Chốt học kỳ** (chốt 2026-10-18): hộp thoại liệt kê sinh viên còn học phần chưa có kết quả → Admin xác nhận → `EvaluationRun` `TERM_CLOSING` (cả học kỳ) — lần chạy CUỐI: `ACA-02/03/04` tính trên các học phần đã có kết quả, lý do ghi "còn N học phần chưa có kết quả" → chạy xong thành công thì hệ thống đặt `Term.closedAt` (Audit Log `TERM_CLOSED`). Lần chạy lỗi → học kỳ chưa chốt, Admin chốt lại.
- Không có phạm vi chạy theo Khoa; xem theo khoa bằng bộ lọc Khoa.
- MUST: mọi đường dùng chung 1 job; chỉ dùng `RuleVersion` `ACTIVE`; chạy lại MUST NOT tạo `Alert` trùng.
- Chạy cho 1 học phần (`courseId`): luật `PER_COURSE` chỉ xét học phần đó; luật `PER_STUDENT` vẫn tính đầy đủ cho các sinh viên có `Enrollment` của học phần đó.

## Tham số dữ liệu dùng chung — `condition` của `RISK-SCORE` (1 nguồn, không lặp ở từng luật)

`{ weights: { attendance 0.4, lms 0.3, academic 0.3 }, attendance: { freshnessDays 14, countExcused true, normalizer 0.2 }, lms: { participationThreshold 0.5, graceDays 3 }, academic: { gradeScale, safeGpa 2.0 } }`.

- `freshnessDays` quyết định `STALE` cho mọi `ATT-*`.
- `lms` định nghĩa "đến hạn" cho bài trắc nghiệm KHÔNG có hạn nộp (cách dự phòng, xem `LMS-01`).
- `gradeScale` — quy đổi điểm chữ → hệ 4 theo Quy chế 336 Điều (quy đổi điểm): **A+ 4,0 · A 3,8 · B+ 3,5 · B 3,0 · C+ 2,5 · C 2,0 · D+ 1,5 · D 1,0 · F 0** (mỗi giá trị bội số 0,1). Dùng chung cho `ACA-03`, `ACA-04`, RiskScore. Điểm chữ chưa có trong `gradeScale` → bỏ qua kết quả đó + cảnh báo chất lượng dữ liệu.
- ĐTB hệ 4 = `Σ(điểm × tín chỉ) / Σ tín chỉ` trên các kết quả có `credits`. MUST so sánh bằng số nguyên phần mười: `Σ(10 × điểm × TC)` với `10 × ngưỡng × ΣTC` (KHÔNG so sánh số thực).
- Mốc `asOf` chọn theo ngày = hết ngày đó giờ Việt Nam (không vượt quá thời điểm hiện tại).

## DataStatus từng nhóm (bước 4)

- Điểm danh: `AVAILABLE` nếu có snapshot và `asOf − snapshotDate ≤ freshnessDays`; `STALE` nếu cũ hơn; `MISSING` nếu chưa có; `INVALID` nếu `excusedAbsence + unexcusedAbsence > totalPeriods` hoặc `totalPeriods ≤ 0`.
- Trắc nghiệm: `NOT_APPLICABLE` nếu lớp học phần của `Enrollment` chưa có bài trắc nghiệm nào "đã biết" tại `asOf` (có hạn nộp `≤ asOf` hoặc có lượt làm `≤ asOf`); ngược lại `AVAILABLE`.
- Thực hành: `NOT_APPLICABLE` nếu lớp học phần chưa có bài thực hành nào đã đến hạn hoặc có bài nộp `≤ asOf`; ngược lại `AVAILABLE`.
- Học lực: `AVAILABLE` nếu có `CourseResult` tại `asOf`; `MISSING` nếu chưa (bình thường trong học kỳ).

"Lớp học phần của `Enrollment`" = `Enrollment.sectionCode`. Bài LMS gắn với 1 lớp học phần (`LmsActivity.sectionCode`) — sinh viên chỉ bị xét các bài của lớp học phần mình.

## RiskScore — chuẩn hóa từng thành phần về [0, 1]

- Điểm danh: `min(1, absenceRate / normalizer)` (0,20 = ngưỡng cấm thi). Gộp: Σ tiết vắng / Σ tổng số tiết trên các `Enrollment` điểm danh `AVAILABLE`.
- LMS: (bài trắc nghiệm đến hạn bị bỏ + bài thực hành không nộp) / (bài trắc nghiệm đến hạn + bài thực hành đã đến hạn), cộng dồn các học phần; 0 nếu chưa có bài đến hạn. `AVAILABLE` khi trắc nghiệm hoặc thực hành `AVAILABLE` ở ≥ 1 học phần.
- Học lực (chốt 2026-10-18): ĐTB hệ 4 của học kỳ đang tính trên các học phần đã có kết quả; nếu học kỳ này chưa có kết quả nào → ĐTB **học kỳ liền trước** (kết quả đã công bố `≤ asOf`); không có cả hai → `MISSING`. Chuẩn hóa `min(1, max(0, (safeGpa − ĐTB) / safeGpa))` (ĐTB ≥ 2,0 → 0; 1,0 → 0,5; 0 → 1). `rawValue` = ĐTB; thành phần ghi rõ nguồn (học kỳ này / học kỳ trước).
- Trọng số mặc định 0.4 / 0.3 / 0.3. Lý do (người dùng chốt 2026-10-15): điểm danh nặng nhất vì là nguồn duy nhất gắn hậu quả cứng trong quy chế (vắng > 20% bị cấm thi) và có số liệu hằng tuần; LMS và học lực ngang nhau. Giá trị khởi đầu, CHƯA hiệu chỉnh bằng dữ liệu thật. Cấu hình = `RuleVersion` `ACTIVE` của `Rule` đặc biệt `RISK-SCORE` (`ruleGroup = RISK_SCORE`) — chung cơ chế phiên bản / chạy thử / kích hoạt / Audit Log với 12 luật; KHÔNG nằm trong registry, KHÔNG tạo `RuleTrigger`. Thành phần không `AVAILABLE` bị loại khỏi tử và mẫu.
- RiskScore CHỈ để hiển thị và sắp xếp — KHÔNG tạo `RuleTrigger`/`Alert`.

## Nhóm điểm danh (nguồn: snapshot mới nhất của `Enrollment`, đơn vị TIẾT)

**ATT-01 — Vắng gần ngưỡng cấm thi**
Căn cứ quy chế: nghỉ **vượt quá 20%** tổng số tiết của học phần (cả có phép và không phép) bị cấm dự thi. Hệ thống chỉ CẢNH BÁO — MUST NOT ghi điểm F hay trạng thái cấm thi.
`absenceRate = (unexcusedAbsence + excusedAbsence) / totalPeriods` (`countExcused = false` → chỉ không phép). `totalPeriods` = tổng số tiết của học phần (cột `tong_so_tiet`) — mẫu số cố định nên đầu kỳ không bị phóng đại, không cần ngưỡng số buổi tối thiểu.
Dải: `≥ 10%` → `MEDIUM`; `≥ 15%` → `HIGH`; `> 20%` → `CRITICAL` ("đã vượt ngưỡng cấm thi"). Đúng 20% là `HIGH`. Cài dạng nhánh, lấy dải cao nhất. MUST so sánh bằng số nguyên (`tiết vắng × 100 > 20 × totalPeriods`).

**ATT-02 — Vắng tăng nhanh**
So snapshot mới nhất S2 với snapshot liền trước S1 của cùng `Enrollment`, khi `S2.snapshotDate − S1.snapshotDate ≤ windowDays` (mặc định 14). `(S2.unexcusedAbsence − S1.unexcusedAbsence) × 100 ≥ minIncreasePercent × S2.totalPeriods` (mặc định 10%) → `HIGH`. Ví dụ môn 45 tiết: tăng ≥ 5 tiết.
Chênh lệch âm (dữ liệu bị sửa) → không kích hoạt, ghi cảnh báo chất lượng dữ liệu. Chỉ có 1 snapshot → không xét.

## Nhóm LMS — bài trắc nghiệm (nguồn: `LmsActivity` QUIZ + `LmsQuizAttempt`)

Bài trắc nghiệm Q **đến hạn** tại `asOf`:
- Q có hạn nộp (`dueAt`): `dueAt ≤ asOf`.
- Q không có hạn nộp (dự phòng, như bản 1): tỷ lệ sinh viên của lớp học phần có ≥ 1 lượt `SUBMITTED` cho Q ≥ `participationThreshold` VÀ `asOf −` lượt làm đầu tiên của lớp cho Q `≥ graceDays`.

**LMS-01 — Bỏ bài trắc nghiệm**: đếm bài đến hạn mà sinh viên không có lượt `SUBMITTED` (nộp `≤ asOf`): 1 bài → `MEDIUM`; ≥ 2 bài → `HIGH`.

**LMS-02 — Điểm trắc nghiệm thấp**: lấy 2 bài đến hạn gần nhất (theo hạn nộp, không có thì theo lượt làm đầu tiên của lớp) mà sinh viên đã nộp; điểm mỗi bài = lượt cao nhất `score / maxScore`. Lượt có `maxScore` NULL bị bỏ qua + cảnh báo chất lượng dữ liệu. Cả 2 bài `< 50%` → `MEDIUM`. Chưa đủ 2 bài đã nộp → không xét. `correctCount / totalQuestions` chỉ hiển thị, không dùng để cảnh báo.

## Nhóm LMS — bài thực hành (nguồn: `LmsActivity` ASSIGNMENT + `LmsAssignmentSubmission`)

Chỉ dựa trạng thái nộp (giảng viên có thể chưa chấm điểm). Trạng thái tại `asOf` của 1 bài: có `submittedAt ≤ asOf` → đã nộp (trễ nếu `submittedAt > dueAt`); chưa nộp và `dueAt ≤ asOf` → **không nộp**; chưa nộp và chưa đến hạn → bình thường, không xét. Sinh viên không có dòng nào cho 1 bài của lớp học phần mình → coi là chưa nộp.

**LMS-03 — Không nộp bài thực hành**: số bài không nộp: 1 → `MEDIUM`; ≥ 2 → `HIGH`.

**LMS-04 — Nộp trễ nhiều**: ≥ 2 bài nộp trễ trong 1 học phần → `LOW` (chỉ trong ứng dụng).

## Nhóm học lực (nguồn: `CourseResult` — chỉ nạp khi học phần đã khóa điểm)

**ACA-01 — Không đạt học phần** (`PER_COURSE`, xét `Enrollment` `COMPLETED` — báo ngay khi học phần khóa điểm, không chờ hết học kỳ)
`passed = false` (điểm chữ F) → `HIGH`. `reason` nêu rõ khi `eligibleForExam = false` ("không được dự thi") hoặc `absentFromExam = true` ("vắng thi").

**Điều kiện chung ACA-02/03/04 — đủ kết quả học kỳ**: chỉ xét khi mọi `Enrollment` không `WITHDRAWN` của sinh viên trong học kỳ đã `COMPLETED` tại `asOf`, HOẶC lần chạy là `TERM_CLOSING` (khi đó tính trên học phần đã có kết quả, `reason` thêm "còn N học phần chưa có kết quả"). Chưa đủ → không xét (không phải "không rủi ro").

**ACA-02 — Tín chỉ không đạt trong học kỳ** (`PER_STUDENT`)
`tỷ lệ = Σ tín chỉ không đạt / Σ tín chỉ có kết quả` (học phần có `credits`). `≥ 25%` → `HIGH`; `> 50%` → `CRITICAL` ("chạm ngưỡng cảnh báo học tập theo quy chế — Điều 11a"). So sánh số nguyên (`TC rớt × 100 > 50 × ΣTC`). Học phần thiếu `credits` → bỏ qua + cảnh báo chất lượng dữ liệu.

**ACA-03 — ĐTB học kỳ thấp** (`PER_STUDENT`)
ĐTB hệ 4 của học kỳ (`gradeScale` ở `RISK-SCORE`). Chỉ xét khi `Σ credits ≥ minCredits` (mặc định 1). `< 2,0` → `HIGH`; `< 1,0` → `CRITICAL` ("chạm ngưỡng Điều 11b"); **học kỳ đầu khóa** dùng ngưỡng `CRITICAL` riêng `< 0,8`. Học kỳ đầu khóa = `HK1` của năm học bắt đầu bằng khóa tuyển sinh của lớp sinh hoạt (`AdministrativeClass.cohortYear`, VD `2024` → `HK1_2024`); khóa không phải năm 4 chữ số → dùng ngưỡng thường.

**ACA-04 — Sa sút qua các học kỳ** (`PER_STUDENT`)
So với **học kỳ liền trước** = học kỳ ngay trước theo `Term.startDate` trong hệ thống. Sinh viên không có kết quả (công bố `≤ asOf`) ở học kỳ đó → **không xét**. Mọi chỉ số học kỳ trước tính lại TỪ DỮ LIỆU (hàm thuần dùng chung với ACA-02/03 và `condition` ACTIVE của chúng) — KHÔNG đọc cảnh báo đã lưu.
- (a) ĐTB giảm `≥ minDrop` (mặc định 1,0) → `MEDIUM`.
- (b) Học kỳ trước VÀ học kỳ này đều có mức ACA-02 hoặc ACA-03 `≥ consecutiveMinSeverity` (mặc định `CRITICAL` = chạm ngưỡng quy chế) → `CRITICAL` ("2 học kỳ liên tiếp chạm ngưỡng quy chế; quy chế: 3 lần cảnh báo liên tiếp bị buộc thôi học — tham khảo").
Lấy mức cao nhất của (a), (b).

## Nhóm kết hợp (chạy sau cùng, trên cùng `Enrollment` `REGISTERED`, cùng lần chạy)

**COMB-01 — Nhiều nguồn cùng xấu**: có dấu hiệu `≥ MEDIUM` ở `≥ 2` trong 3 nguồn: điểm danh (`ATT-01`/`ATT-02`) · trắc nghiệm (`LMS-01`/`LMS-02`) · thực hành (`LMS-03`) → `CRITICAL`.

**COMB-02 — Học lại vẫn sa sút**: lần học `≥ 2` (đã không đạt học phần này ở học kỳ trước) VÀ có dấu hiệu `ATT-*`/`LMS-*` `≥ MEDIUM` → severity = mức cao nhất đang có + 1 bậc (tối đa `CRITICAL`). `reason` MUST nêu học kỳ đã rớt. Lần học do hệ thống tự đếm từ kết quả đã nạp (không cần cột "học lại lần mấy"); học kỳ trước khi dùng hệ thống phải nạp bảng điểm cũ thì mới nhận ra.

## Ngoại lệ — Bước 3, chặn TRƯỚC khi luật chạy

- `Enrollment.enrollmentStatus = WITHDRAWN` (Admin đánh dấu) → bỏ qua mọi luật của `Enrollment` đó. Đánh dấu/bỏ đánh dấu KHÔNG tự chạy đánh giá.
- Học kỳ đã chốt (`Term.closedAt`) → không tạo `EvaluationRun`.
- Điểm danh `STALE`/`INVALID`/`MISSING` → không chạy `ATT-*`.
- Trắc nghiệm `NOT_APPLICABLE` → không chạy `LMS-01/02`; thực hành `NOT_APPLICABLE` → không chạy `LMS-03/04`.
- Chưa đủ kết quả học kỳ (trừ `TERM_CLOSING`) → không chạy `ACA-02/03/04`.

## Giới hạn đã biết — ghi vào báo cáo, MUST NOT tự "vá" bằng logic đoán

- Không có file Excel thật của trường (chỉ ảnh màn hình) → mẫu file thiết kế theo cột trong ảnh, tiêu đề 1 dòng; file xuất của trường (tiêu đề nhiều tầng) phải chép sang mẫu.
- Mã học phần suy từ mã lớp học phần bằng cách bỏ 2 số cuối (giả định, chưa xác nhận chính thức) — sai thì học lại (`COMB-02`) không nhận ra; Admin điền `ma_hoc_phan` riêng khi biết.
- Bài trắc nghiệm không có hạn nộp → `LMS-01` chỉ bắt được bài đa số lớp đã làm.
- Điểm danh là số tổng hợp → không phát hiện "vắng liên tiếp" chính xác; `ATT-02` xấp xỉ theo mức tăng giữa 2 lần nhập.
- Không biết sinh viên rút học phần từ dữ liệu nguồn → Admin đánh dấu tay.
- Không có danh sách đăng ký học phần: sinh viên không xuất hiện trong file nào của học phần thì hệ thống không biết; "tín chỉ đăng ký" của ACA-02 = tín chỉ các học phần có kết quả.
- `ACA-04` "học kỳ liền trước" theo lịch học kỳ của hệ thống — sinh viên bảo lưu 1 học kỳ thì không so sánh.
- Nạp một phần (nhiều dòng LMS lỗi) làm lệch tỷ lệ "đa số lớp đã làm" → xem trước cảnh báo khi tỷ lệ lỗi > 10% (`12`).

Cảnh báo nghi báo sai do các giới hạn này: CVHT dùng `DISMISSED` kèm lý do.

## Gộp nguyên nhân & chống trùng cảnh báo (Bước 7–9) — người dùng chốt 2026-10-13

- **Đơn vị gộp: 1 `Alert` / sinh viên / học kỳ** — gộp MỌI dấu hiệu (mọi luật, mọi học phần) của sinh viên trong học kỳ. "Dấu hiệu" = cặp `(ruleCode, scopeId)`; chi tiết cảnh báo nhóm dấu hiệu theo nguồn. Tối đa 1 `Alert` CHƯA ĐÓNG / `(studentId, termId)` (partial unique index).
- Mỗi lần chạy có trigger của sinh viên: gắn trigger vào `Alert` của `(studentId, termId)`; `lastDetectedAt` = lúc chạy; `severity` = max severity các dấu hiệu hiện tại.
  - Chưa có `Alert` → tạo `OPEN` (thông báo).
  - `Alert` đang mở (`OPEN`/`ACKNOWLEDGED`/`IN_PROGRESS`/`REOPENED`) → cập nhật; `severity` tăng → thông báo; giảm thì chỉ cập nhật. **Lần chạy theo 1 học phần chỉ được TĂNG mức** — chỉ lần chạy cả học kỳ mới hạ mức (chốt 2026-10-15).
  - **Dữ liệu quá hạn ≠ hết dấu hiệu** (chốt 2026-10-15): `Alert.currentTriggerIds` lưu "dấu hiệu hiện tại". Lần chạy cả học kỳ thay toàn bộ dấu hiệu hiện tại bằng dấu hiệu của lần chạy, TRỪ dấu hiệu `ATT-*`/`COMB-*` của học phần có điểm danh `STALE` ở lần chạy đó — được GIỮ và vẫn tính vào mức. Lần chạy theo học phần chỉ thay dấu hiệu của học phần đó (và dấu hiệu cả học kỳ).
  - Lần chạy cả học kỳ mà `Alert` đang mở KHÔNG còn dấu hiệu nào → không tự đóng, không đổi mức; ghi nhận "lần đánh giá gần nhất không còn dấu hiệu" (chốt 2026-10-15).
  - `Alert` đã đóng (`RESOLVED`/`DISMISSED`) → **mở lại theo dấu hiệu, không theo thời gian**: dấu hiệu MỚI hoặc NẶNG HƠN mức đã ghi nhận → `REOPENED` (thông báo); y hệt/nhẹ hơn → chỉ gắn trigger làm bằng chứng. `Rule.cooldown` (giờ) mặc định 0 = tắt.
  - `Alert` `INVALIDATED` → không mở lại; dấu hiệu xuất hiện lại sau đó tạo `Alert` mới.
- Lần chạy có `asOf` CŨ hơn `Alert.lastAsOf` → chỉ gắn trigger làm bằng chứng, MUST NOT đổi mức/trạng thái.
- Hoàn tác lô (xem `12`): lần chạy lại sau hoàn tác mà `Alert` đang mở không còn dấu hiệu nào → `INVALIDATED` (`changedBy` NULL, lý do "dữ liệu nguồn đã được hoàn tác"). Ngoài trường hợp này hệ thống KHÔNG tự đóng cảnh báo.
- Job chạy lại (retry) MUST NOT tạo `Alert` hay thông báo trùng: unique index ở trên + `jobId` thông báo theo `(alertId, sự kiện, evaluationRunId)`.
