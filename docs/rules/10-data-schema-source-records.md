# 10 — Data Schema Reference: Source Records (Data-Import Module)

Xem `00-project-context.md` và `09-data-schema-identity.md` trước (đặc biệt `Enrollment`). File này đặc tả các bảng dữ liệu nguồn — đầu vào duy nhất của `rule-engine`. Bảng theo sinh viên trỏ qua `enrollmentId`, KHÔNG trỏ thẳng `studentId` + `courseId`.

Phiên bản 2 (Phase 8a, chốt 2026-10-18): cột theo ảnh hệ thống của trường (điểm danh theo TIẾT; Moodle bài trắc nghiệm và bài nộp; bảng điểm học phần đã khóa). Cột file: xem `12-data-schema-ops.md`.

**Thời gian trong file nguồn** không ghi múi giờ → MUST hiểu là giờ Việt Nam (UTC+7). Cột chỉ có ngày (`ngay_chot`, `ngay_cong_bo`) → 00:00 giờ Việt Nam; `han_nop` chỉ có ngày → 23:59 giờ Việt Nam của ngày đó. Lưu `timestamptz` (UTC).

**Nạp lại là cập nhật, không nhân đôi**: mọi bảng upsert theo khóa nghiệp vụ (UNIQUE bên dưới). Audit Log ghi ở cấp lô nhập.

**Họ tên trong file** (`ho_dem`, `ten`) chỉ để đối chiếu, KHÔNG lưu vào các bảng này (tên lấy từ `Student`).

## AttendanceSummary — số liệu điểm danh tổng hợp tại 1 ngày chốt (đơn vị TIẾT)

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| enrollmentId | String (uuid) | NOT NULL | FK → Enrollment | |
| snapshotDate | DateTime | NOT NULL | | Ngày chốt (`ngay_chot`) |
| totalPeriods | Int | NOT NULL | | Tổng số tiết của học phần (`tong_so_tiet`, VD 45) — mẫu số `ATT-01` |
| excusedAbsence | Int | NOT NULL | | Số tiết vắng có phép, cộng dồn đến ngày chốt |
| unexcusedAbsence | Int | NOT NULL | | Số tiết vắng không phép, cộng dồn đến ngày chốt |
| sectionCode | String(30) | NOT NULL | | Mã lớp học phần của dòng (`ma_lop_hoc_phan`) |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | |
| createdAt | DateTime | NOT NULL | | |

RÀNG BUỘC: UNIQUE `(enrollmentId, snapshotDate)`. Nhập lại cùng ngày chốt → cập nhật; ngày khác → bản ghi mới; MUST NOT xóa snapshot ngày khác (`ATT-02` cần lịch sử). Validate: số nguyên ≥ 0, `totalPeriods` 1–500, `excusedAbsence + unexcusedAbsence ≤ totalPeriods`, sai → `OUT_OF_RANGE`. `snapshotDate` ngoài `[Term.startDate, Term.endDate]` → `TERM_MISMATCH`. Cột `ty_le_vang` (nếu có) chỉ đối chiếu: lệch quá 0,5 điểm % so với số tính lại → cảnh báo `ABSENCE_RATE_MISMATCH`.

## LmsActivity — 1 bài trên LMS của 1 lớp học phần

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| courseId | String(20) | NOT NULL | FK → Course | |
| termId | String(10) | NOT NULL | FK → Term | |
| sectionCode | String(30) | NOT NULL | | Lớp học phần (`ma_lop_hoc_phan`) |
| activityType | LmsActivityType (enum) | NOT NULL | | `QUIZ` (trắc nghiệm) / `ASSIGNMENT` (bài thực hành nộp file) |
| activityKey | String(100) | NOT NULL | | `ma_bai`; trống → tên bài chuẩn hóa (bỏ dấu, chữ thường, gộp khoảng trắng) |
| activityName | String(200) | NOT NULL | | `ten_bai` |
| dueAt | DateTime | NULL | | Hạn nộp (`han_nop`). BẮT BUỘC với `ASSIGNMENT`; tùy chọn với `QUIZ` |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | Lô cập nhật gần nhất |

RÀNG BUỘC: UNIQUE `(courseId, termId, sectionCode, activityType, activityKey)`. Mọi dòng của cùng 1 bài trong 1 file MUST có cùng `han_nop` (lệch → lỗi dòng `INVALID_FORMAT` "hạn nộp khác các dòng trước của cùng bài"). Nạp lại với hạn nộp khác (giảng viên gia hạn) → cập nhật + cảnh báo `DUE_DATE_CHANGED`.

## LmsQuizAttempt — 1 lượt làm bài trắc nghiệm

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| enrollmentId | String (uuid) | NOT NULL | FK → Enrollment | |
| activityId | String (uuid) | NOT NULL | FK → LmsActivity | Bài `QUIZ` |
| attemptNumber | Int | NOT NULL | | `lan_lam`; trống → thứ tự theo `startedAt` của sinh viên với bài đó TRONG file |
| startedAt | DateTime | NOT NULL | | |
| submittedAt | DateTime | NULL | | |
| durationMinutes | Float | NULL | | |
| score | Float | NULL | | |
| maxScore | Float | NULL | | `8/10` tách được |
| correctCount | Int | NULL | | Số câu làm đúng — chỉ hiển thị |
| totalQuestions | Int | NULL | | Tổng số câu — chỉ hiển thị |
| status | QuizAttemptStatus (enum) | NOT NULL | | `SUBMITTED`/`IN_PROGRESS`/`ABANDONED` |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | |

RÀNG BUỘC: UNIQUE `(enrollmentId, activityId, attemptNumber)`. Dòng `trang_thai = Chưa làm` KHÔNG tạo lượt làm (chỉ tạo `Enrollment` + `LmsActivity`) — bài bị bỏ được suy ra ở `rule-engine`. Validate: `0 ≤ score ≤ maxScore`, `submittedAt ≥ startedAt`, `0 ≤ correctCount ≤ totalQuestions`; `SUBMITTED` MUST có `submittedAt` và `score`. `startedAt` ngoài học kỳ → `TERM_MISMATCH`.

## LmsAssignmentSubmission — trạng thái nộp 1 bài thực hành của 1 sinh viên

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| enrollmentId | String (uuid) | NOT NULL | FK → Enrollment | |
| activityId | String (uuid) | NOT NULL | FK → LmsActivity | Bài `ASSIGNMENT` |
| status | SubmissionStatus (enum) | NOT NULL | | `ON_TIME` (Đã nộp) / `LATE` (Nộp trễ) / `NOT_SUBMITTED` (Chưa nộp) — theo file |
| submittedAt | DateTime | NULL | | BẮT BUỘC khi `ON_TIME`/`LATE` (chống rò rỉ thời gian: biết đã nộp TẠI `asOf`) |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | |

RÀNG BUỘC: UNIQUE `(enrollmentId, activityId)` — nạp lại cập nhật trạng thái (Chưa nộp → Nộp trễ). `ON_TIME` mà `submittedAt > dueAt`, hoặc `LATE` mà `submittedAt ≤ dueAt` → cảnh báo `SUBMISSION_STATUS_MISMATCH` (nạp theo thời điểm nộp). KHÔNG lưu điểm (giảng viên có thể chưa chấm).

## CourseResult — kết quả 1 học phần đã khóa điểm

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| enrollmentId | String (uuid) | NOT NULL | FK → Enrollment, UNIQUE | 1 kết quả / `Enrollment` |
| processScore | Float | NULL | | Điểm thường xuyên, thang 10 — chỉ hiển thị |
| examScore | Float | NULL | | Điểm cuối kỳ, thang 10 — chỉ hiển thị |
| letterGrade | String(2) | NOT NULL | | Thang 9 mức (Quy chế 336): 9,5–10 `A+` · 8,5–9,4 `A` · 8,0–8,4 `B+` · 7,0–7,9 `B` · 6,5–6,9 `C+` · 5,5–6,4 `C` · 5,0–5,4 `D+` · 4,0–4,9 `D` · < 4 `F` |
| passed | Boolean | NOT NULL | | `letterGrade != 'F'` |
| eligibleForExam | Boolean | NULL | | `duoc_du_thi` (Không = bị cấm thi) |
| absentFromExam | Boolean | NULL | | `vang_thi` |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | Lô cập nhật gần nhất |
| publishedAt | DateTime | NOT NULL | | `ngay_cong_bo`; trống thì = lúc nạp. Dùng cho mốc `asOf` |
| importedAt | DateTime | NOT NULL | | |

KHÔNG lưu điểm hệ 4 — `rule-engine` quy đổi từ `letterGrade` theo `gradeScale` (`08`). Cột `thang_diem_4` của file chỉ đối chiếu: lệch quy đổi → cảnh báo `GRADE_POINT_MISMATCH`. `diem_chu` ∉ thang 9 mức → `INVALID_FORMAT`.

RÀNG BUỘC: chỉ nạp khi học phần đã khóa điểm (người dùng chốt 2026-10-18 — không còn điểm giữa kỳ). Có kết quả → cập nhật `Enrollment.attemptOutcome` (`PASSED`/`FAILED`) và `enrollmentStatus = COMPLETED`. Nạp lại với điểm khác (đính chính) → cập nhật. Điểm thang 10 trong `[0, 10]`, sai → `OUT_OF_RANGE`. `ngay_cong_bo` có thể sau ngày kết thúc học kỳ. MUST NOT ghi `Student.officialAcademicStatus`.

**Tính lại lần học**: khi `attemptOutcome` của 1 `Enrollment` thay đổi, MUST tính lại `attemptNumber` của các `Enrollment` cùng `(studentId, courseId)` ở học kỳ SAU (theo `Term.startDate`) trong cùng transaction.

## Quan hệ tóm tắt

`Enrollment 1—n AttendanceSummary, LmsQuizAttempt, LmsAssignmentSubmission` · `Enrollment 1—0..1 CourseResult` · `LmsActivity 1—n LmsQuizAttempt, LmsAssignmentSubmission` · `Course, Term 1—n LmsActivity` · tất cả `n—1 ImportBatch`.
