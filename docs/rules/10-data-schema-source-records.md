# 10 — Data Schema Reference: Source Records (Data-Import Module)

Xem `00-project-context.md` và `09-data-schema-identity.md` trước (đặc biệt `Enrollment`). File này đặc tả 3 bảng dữ liệu nguồn — đầu vào duy nhất của `rule-engine`. Cả 3 bảng trỏ qua `enrollmentId`, KHÔNG trỏ thẳng `studentId` + `courseId`.

Ba nguồn tương ứng định dạng xuất phổ biến của hệ thống e-learning (VD: Moodle — báo cáo bài kiểm tra, báo cáo điểm danh) và cổng đào tạo (bảng điểm học phần). Cột file từng loại: xem `12-data-schema-ops.md`.

**Thời gian trong file nguồn** không ghi múi giờ → MUST hiểu là giờ Việt Nam (UTC+7). Cột chỉ có ngày (`ngay_chot`, `ngay_cong_bo`) → 00:00 giờ Việt Nam của ngày đó. Lưu `timestamptz` (UTC) trong DB.

**Nạp lại là cập nhật, không nhân đôi**: cả 3 bảng upsert theo khóa nghiệp vụ (UNIQUE bên dưới). Audit Log ghi ở cấp lô nhập (số dòng thêm mới / cập nhật), không ghi từng dòng.

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

RÀNG BUỘC: UNIQUE `(enrollmentId, snapshotDate)`. Nhập lại cùng ngày chốt → cập nhật bản ghi đó; ngày chốt khác → bản ghi mới. MUST NOT xóa/ghi đè snapshot của ngày khác (`ATT-02` cần lịch sử). Validate: các số nguyên ≥ 0, `present + late + excusedAbsence + unexcusedAbsence ≤ totalSessions`, `plannedSessions ≥ totalSessions` khi có, sai → `OUT_OF_RANGE`. `snapshotDate` phải nằm trong `[Term.startDate, Term.endDate]` của học kỳ đã chọn, sai → `TERM_MISMATCH`.

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

RÀNG BUỘC: UNIQUE `(enrollmentId, quizKey, attemptNumber)`. File LMS thường xuất lũy kế (chứa cả lượt cũ) → nạp lại cùng lượt thì cập nhật (VD `IN_PROGRESS` → `SUBMITTED`). Chỉ lưu lượt có thật — MUST NOT tạo bản ghi "chưa làm" (bài bị bỏ được suy ra ở `rule-engine`, xem `LMS-01` trong `08`). Validate: `0 ≤ score ≤ maxScore`, `submittedAt ≥ startedAt`; `SUBMITTED` MUST có `submittedAt` và `score`. `startedAt` phải nằm trong thời gian học kỳ, sai → `TERM_MISMATCH`.

## CourseResult — kết quả 1 học phần của 1 sinh viên trong 1 học kỳ

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| enrollmentId | String (uuid) | NOT NULL | FK → Enrollment, UNIQUE | 1 kết quả / `Enrollment` |
| processScore | Float | NULL | | Điểm quá trình, thang 10 |
| examScore | Float | NULL | | Điểm thi, thang 10 |
| finalScore | Float | NULL | | Điểm tổng kết, thang 10 |
| letterGrade | String(2) | NULL | | Thang 9 mức theo quy chế trường (người dùng xác nhận): 9,5–10 = `A+` · 8,5–9,4 = `A` · 8,0–8,4 = `B+` · 7,0–7,9 = `B` · 6,5–6,9 = `C+` · 5,5–6,4 = `C` · 5,0–5,4 = `D+` · 4,0–4,9 = `D` (đạt) · 0,0–3,9 = `F` (không đạt). Trống mà có `finalScore` → quy đổi theo thang này |
| passed | Boolean | NULL | | Từ cột `ket_qua`; nếu trống thì `letterGrade != 'F'` (F = không đạt, phải học lại); NULL khi chưa có kết quả cuối |
| resultStatus | CourseResultStatus (enum) | NOT NULL | | `PROCESS_ONLY` (mới có điểm quá trình) / `FINAL` |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | Batch cập nhật gần nhất |
| publishedAt | DateTime | NOT NULL | | Ngày công bố điểm (`ngay_cong_bo`); trống thì = `importedAt`. Dùng cho mốc `asOf` |
| importedAt | DateTime | NOT NULL | | Thời điểm nạp |
| processPublishedAt | DateTime | NULL | | Ngày công bố điểm quá trình (lần nạp `PROCESS_ONLY`), GIỮ LẠI khi chuyển `FINAL` — để chạy lại đánh giá ở mốc giữa kỳ không mất `ACA-01` (chống rò rỉ thời gian, xem `08`) |

Không lưu điểm hệ 4: `rule-engine` quy đổi từ `letterGrade` theo `gradeScale` của `ACA-03` lúc đánh giá (xem `08`).

RÀNG BUỘC: nhập lần đầu chỉ có điểm quá trình → `PROCESS_ONLY`; nhập lại khi có `finalScore` hoặc `ket_qua` → cập nhật thành `FINAL`. Khi `FINAL`: cập nhật `Enrollment.attemptOutcome` (`PASSED`/`FAILED`) và `enrollmentStatus = COMPLETED`. MUST NOT chuyển `FINAL` về `PROCESS_ONLY`: dòng chỉ có điểm quá trình cho kết quả đã `FINAL` → lỗi `RESULT_ALREADY_FINAL`. Nhập lại `FINAL` với điểm khác (đính chính) → cập nhật. Điểm thang 10 phải trong `[0, 10]`, sai → `OUT_OF_RANGE`. `diem_chu` lệch với `diem_tong_ket` theo thang trên → vẫn nạp theo `diem_chu` của nguồn, ghi cảnh báo vào `ImportBatch.warnings`. `ngay_cong_bo` có thể sau ngày kết thúc học kỳ (không kiểm tra). MUST NOT ghi `Student.officialAcademicStatus`.

**Tính lại lần học**: khi `attemptOutcome` của 1 `Enrollment` thay đổi (có/đính chính kết quả `FINAL`), MUST tính lại `attemptNumber` của các `Enrollment` cùng `(studentId, courseId)` ở học kỳ SAU (theo `Term.startDate`) trong cùng transaction — để thứ tự nạp file không làm sai `COMB-02`.

## Quan hệ tóm tắt

`Enrollment 1—n AttendanceSummary` · `Enrollment 1—n LmsQuizAttempt` · `Enrollment 1—0..1 CourseResult` · cả 3 `n—1 ImportBatch`.
