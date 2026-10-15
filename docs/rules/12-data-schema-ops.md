# 12 — Data Schema Reference: Import & Operational Exceptions

Xem `00-project-context.md` trước. File này đặc tả các bảng vận hành của module `data-import` (`ImportBatch`, `ImportErrorRow`) và checklist chức năng nhập CSV. Chỉ có 4 loại nhập: danh sách sinh viên và 3 nguồn dữ liệu học tập.

## ImportBatch

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| dataType | String(40) | NOT NULL | | Kiểu TS `ImportDataType` (union + Zod, KHÔNG dùng enum Postgres — xem `01`): `STUDENT`/`ATTENDANCE_SUMMARY`/`LMS_QUIZ`/`COURSE_RESULT` |
| termId | String(10) | NULL | FK → Term | Bắt buộc với mọi loại trừ `STUDENT`. Chọn trên form nhập, mặc định học kỳ `isCurrent` |
| source | ImportSource (enum) | NOT NULL | | `FILE` (MVP chỉ nhập CSV). Tên enum `ImportSource` để tránh trùng class `DataSource` của TypeORM |
| sourceChecksum | String(64) | NOT NULL | | Dùng chống nhập trùng — MUST dùng làm BullMQ `jobId` (xem `01-architecture.md`) |
| performedBy | String(20) | NOT NULL | FK → User | |
| status | ImportBatchStatus (enum) | NOT NULL | | `UPLOADING`→`VALIDATING`→`STAGED`→`LOADED`→`RECONCILED` / `REJECTED` / `DISCARDED` |
| totalRows | Int | NOT NULL | | |
| successRows | Int | NOT NULL | | |
| errorRows | Int | NOT NULL | | |
| parentBatchId | String (uuid) | NULL | FK → ImportBatch | Liên kết batch sửa lỗi với batch gốc |
| originalFilePath | String(255) | NOT NULL | | Lưu trong MinIO — xem `01-architecture.md` |
| createdAt | DateTime | NOT NULL | | |
| completedAt | DateTime | NULL | | |

RÀNG BUỘC: chỉ hủy được (`DISCARDED`) khi `status = STAGED` (chưa `LOADED`, chưa được rule-engine dùng để tính bất kỳ `RiskScoreLog` nào).

## ImportErrorRow

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | |
| sourceRowNumber | Int | NOT NULL | | Số dòng trong file gốc, để người nhập đối chiếu khi sửa |
| rawData | Json | NOT NULL | | Dữ liệu nguyên trạng dòng lỗi |
| errorReason | String(40) | NOT NULL | | Kiểu TS `ImportErrorReason` (union + Zod, KHÔNG dùng enum Postgres — xem `01`): `INVALID_FORMAT`/`STUDENT_NOT_FOUND`/`CLASS_NOT_FOUND`/`DUPLICATE`/`OUT_OF_RANGE`/`TERM_MISMATCH` |
| resolved | Boolean | NOT NULL, default `false` | | |

`STUDENT_NOT_FOUND`: `mssv` chưa có trong danh sách sinh viên — MUST NOT tự tạo sinh viên. `TERM_MISMATCH`: file có cột `hoc_ky` khác học kỳ đã chọn trên form.

## Cột CSV — header tiếng Việt không dấu

Học kỳ chọn trên form nhập (mặc định học kỳ hiện tại); cột `hoc_ky` là tùy chọn, nếu có MUST khớp. Ngày: `YYYY-MM-DD`; ngày giờ: `YYYY-MM-DD HH:mm`. Parser MUST chấp nhận thêm dạng xuất phổ biến của LMS Việt Nam: `HH:mm DD/MM/YYYY`, điểm `8/10`, thời lượng `12 phút`, trạng thái tiếng Việt (`Đã nộp`, `Đạt`, `Không đạt`) — chuẩn hóa về kiểu ở `10` trước khi validate. Cột thừa (VD: `ho_ten`, `lop`) được bỏ qua, không báo lỗi.

- `STUDENT`: `mssv,ho_ten,email,ma_lop_sinh_hoat,trang_thai_hoc_vu`. Lớp sinh hoạt MUST tồn tại (sai → `CLASS_NOT_FOUND`). Tạo/cập nhật `Student` + `User` (`role = STUDENT`, `accountStatus = ACTIVE`, `authUserId = NULL`).
- `ATTENDANCE_SUMMARY`: `mssv,ma_hoc_phan,ten_hoc_phan,ngay_chot,tong_buoi,co_mat,di_tre,vang_co_phep,vang_khong_phep` + tùy chọn `tong_buoi_ke_hoach,ma_lop_hoc_phan`. → `AttendanceSummary`.
- `LMS_QUIZ`: `mssv,ma_hoc_phan,ma_bai,ten_bai,lan_lam,thoi_diem_bat_dau,thoi_diem_nop,thoi_gian_lam_phut,diem,diem_toi_da,trang_thai` + tùy chọn `ma_lop_hoc_phan`. `trang_thai`: `SUBMITTED`/`IN_PROGRESS`/`ABANDONED` (chấp nhận `Đã nộp`/`Đang làm`/`Bỏ dở`). `ma_bai` trống → dùng `ten_bai` chuẩn hóa làm khóa. → `LmsQuizAttempt`.
- `COURSE_RESULT`: `mssv,ma_hoc_phan,ten_hoc_phan,so_tin_chi,diem_qua_trinh,diem_thi,diem_tong_ket,diem_chu,ket_qua` + tùy chọn `ngay_cong_bo`. `ket_qua`: `DAT`/`KHONG_DAT` (chấp nhận `Đạt`/`Không đạt`). Chỉ có `diem_qua_trinh` → `PROCESS_ONLY`; có `diem_tong_ket` hoặc `ket_qua` → `FINAL`. → `CourseResult`, cập nhật `Course.credits`.

Ánh xạ cột → field (`10`): `ngay_chot`→`snapshotDate`, `tong_buoi`→`totalSessions`, `tong_buoi_ke_hoach`→`plannedSessions`, `co_mat`→`present`, `di_tre`→`late`, `vang_co_phep`→`excusedAbsence`, `vang_khong_phep`→`unexcusedAbsence`, `ma_lop_hoc_phan`→`sectionCode`; `ma_bai`→`quizKey`, `ten_bai`→`quizName`, `lan_lam`→`attemptNumber`, `thoi_diem_bat_dau`→`startedAt`, `thoi_diem_nop`→`submittedAt`, `thoi_gian_lam_phut`→`durationMinutes`, `diem`→`score`, `diem_toi_da`→`maxScore`, `trang_thai`→`status`; `diem_qua_trinh`→`processScore`, `diem_thi`→`examScore`, `diem_tong_ket`→`finalScore`, `diem_chu`→`letterGrade`, `ket_qua`→`passed`, `ngay_cong_bo`→`publishedAt`, `so_tin_chi`→`Course.credits`.

Với 3 loại sau `STUDENT`: dòng hợp lệ đầu tiên của `(mssv, ma_hoc_phan)` trong học kỳ MUST upsert `Course` và tạo `Enrollment` nếu chưa có (xem `09-data-schema-identity.md`), trong cùng transaction với việc nạp dòng.

## Quan hệ tóm tắt

`ImportBatch 1—n ImportErrorRow` · `ImportBatch 1—n` (AttendanceSummary, LmsQuizAttempt, CourseResult — xem `10`) · `ImportBatch 0..1—n ImportBatch` (qua `parentBatchId`) · `ImportBatch n—0..1 Term`.

## Chức năng module data-import — checklist bắt buộc

1. Nhập danh sách sinh viên.
2. Nhập điểm danh tổng hợp theo ngày chốt.
3. Nhập kết quả làm bài kiểm tra LMS.
4. Nhập kết quả học phần (giữa kỳ: điểm quá trình; cuối kỳ: đầy đủ).
5. Xem lịch sử các lần nhập (danh sách `ImportBatch`) và số dòng thành công/lỗi.
6. Tải file dòng lỗi kèm lý do diễn giải tiếng Việt.
7. Nhập lại các dòng đã sửa, liên kết batch gốc (`parentBatchId`).
8. Chống nhập trùng file bằng `sourceChecksum`.
9. Hủy batch `STAGED` chưa được dùng để tính RiskScore.
10. Dữ liệu lỗi hoặc chưa đối soát MUST NOT vào Rule Engine (chỉ đọc dữ liệu từ batch `LOADED`/`RECONCILED`).
