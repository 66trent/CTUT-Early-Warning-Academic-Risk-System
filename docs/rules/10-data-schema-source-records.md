# 10 — Data Schema Reference: Source Records (Data-Import Module)

Xem `00-project-context.md` và `09-data-schema-identity.md` trước (đặc biệt `Enrollment`). File này đặc tả 3 bảng dữ liệu nguồn — đầu vào duy nhất của `rule-engine`. Cả 3 bảng trỏ qua `enrollmentId`, KHÔNG trỏ thẳng `studentId` + `courseId`.

Ba nguồn tương ứng định dạng xuất phổ biến của hệ thống e-learning (VD: Moodle — báo cáo bài kiểm tra, báo cáo điểm danh) và cổng đào tạo (bảng điểm học phần). Cột CSV từng loại: xem `12-data-schema-ops.md`.

## AttendanceSummary — số liệu điểm danh tổng hợp tại 1 ngày chốt

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| enrollmentId | String (uuid) | NOT NULL | FK → Enrollment | |
| snapshotDate | DateTime (date) | NOT NULL | | Ngày chốt số liệu (`ngay_chot`) |
| totalSessions | Int | NOT NULL | | Số buổi ĐÃ học tính đến `snapshotDate` |
| plannedSessions | Int | NULL | | Tổng số buổi theo kế hoạch (nếu nguồn có) — dùng khi `ATT-01` chọn mẫu số `PLANNED` |
| present | Int | NOT NULL | | Có mặt |
| late | Int | NOT NULL | | Đi trễ |
| excusedAbsence | Int | NOT NULL | | Vắng có phép |
| unexcusedAbsence | Int | NOT NULL | | Vắng không phép |
| sectionCode | String(30) | NULL | | Mã lớp học phần nếu nguồn có — dùng để tách nhóm |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | |
| createdAt | DateTime | NOT NULL | | |

RÀNG BUỘC: UNIQUE `(enrollmentId, snapshotDate)`. Nhập lại cùng ngày chốt → cập nhật bản ghi đó (ghi Audit Log); ngày chốt khác → bản ghi mới. MUST NOT xóa/ghi đè snapshot của ngày khác (`ATT-02` cần lịch sử). Validate: các số ≥ 0 và `present + late + excusedAbsence + unexcusedAbsence ≤ totalSessions`, sai → dòng lỗi `OUT_OF_RANGE`.

## LmsQuizAttempt — 1 lượt làm bài kiểm tra trên LMS

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| enrollmentId | String (uuid) | NOT NULL | FK → Enrollment | |
| quizKey | String(100) | NOT NULL | | `ma_bai`; nếu nguồn không có mã, dùng tên bài đã chuẩn hóa (bỏ dấu, chữ thường, gộp khoảng trắng) |
| quizName | String(200) | NOT NULL | | Tên bài hiển thị |
| attemptNumber | Int | NOT NULL | | Lần làm thứ mấy (`lan_lam`) |
| startedAt | DateTime | NOT NULL | | |
| submittedAt | DateTime | NULL | | NULL nếu chưa nộp |
| durationMinutes | Float | NULL | | Thời gian làm bài |
| score | Float | NULL | | |
| maxScore | Float | NULL | | Thang điểm của bài. `score`/`maxScore` tách từ dạng `8/10` nếu nguồn ghi gộp |
| status | QuizAttemptStatus (enum) | NOT NULL | | `SUBMITTED`/`IN_PROGRESS`/`ABANDONED` |
| sectionCode | String(30) | NULL | | Như `AttendanceSummary.sectionCode` |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | |

RÀNG BUỘC: UNIQUE `(enrollmentId, quizKey, attemptNumber)`. Chỉ lưu lượt có thật — MUST NOT tạo bản ghi "chưa làm" (bài bị bỏ được suy ra ở `rule-engine`, xem `LMS-01` trong `08`). Validate: `score ≤ maxScore`, `submittedAt ≥ startedAt`.

## CourseResult — kết quả 1 học phần của 1 sinh viên trong 1 học kỳ

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| enrollmentId | String (uuid) | NOT NULL | FK → Enrollment, UNIQUE | 1 kết quả / `Enrollment` |
| processScore | Float | NULL | | Điểm quá trình, thang 10 |
| examScore | Float | NULL | | Điểm thi, thang 10 |
| finalScore | Float | NULL | | Điểm tổng kết, thang 10 |
| letterGrade | String(1) | NULL | | `A`/`B`/`C`/`D`/`F`. Trống mà có `finalScore` → quy đổi: 8,5–10 = A; 7,0–8,4 = B; 5,5–6,9 = C; 4,0–5,4 = D; < 4,0 = F |
| gradePoint4 | Float | NULL | | Hệ 4, quy đổi từ `letterGrade` khi nạp (theo `gradeScale` của `ACA-03`) |
| passed | Boolean | NULL | | Từ cột `ket_qua`; nếu trống thì `letterGrade != 'F'` (F = không đạt, phải học lại); NULL khi chưa có kết quả cuối |
| resultStatus | CourseResultStatus (enum) | NOT NULL | | `PROCESS_ONLY` (mới có điểm quá trình) / `FINAL` |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | Batch cập nhật gần nhất |
| publishedAt | DateTime | NOT NULL | | Ngày công bố điểm (`ngay_cong_bo`); trống thì = `importedAt`. Dùng cho mốc `asOf` |
| importedAt | DateTime | NOT NULL | | Thời điểm nạp |

RÀNG BUỘC: nhập lần đầu chỉ có điểm quá trình → `PROCESS_ONLY`; nhập lại khi có `finalScore` hoặc `ket_qua` → cập nhật thành `FINAL` (ghi Audit Log). Khi `FINAL`: cập nhật `Enrollment.attemptOutcome` (`PASSED`/`FAILED`) và `enrollmentStatus = COMPLETED`. MUST NOT chuyển `FINAL` về `PROCESS_ONLY`. `diem_chu` lệch với `diem_tong_ket` theo thang trên → vẫn nạp theo `diem_chu` của nguồn, ghi cảnh báo trong kết quả batch. MUST NOT ghi `Student.officialAcademicStatus`.

## Quan hệ tóm tắt

`Enrollment 1—n AttendanceSummary` · `Enrollment 1—n LmsQuizAttempt` · `Enrollment 1—0..1 CourseResult` · cả 3 `n—1 ImportBatch`.
