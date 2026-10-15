# 12 — Data Schema Reference: Import & Operational Exceptions

Xem `00-project-context.md` trước. File này đặc tả các bảng vận hành của module `data-import` (`ImportBatch`, `ImportErrorRow`) và checklist chức năng nhập file. Chỉ có 4 loại nhập: danh sách sinh viên và 3 nguồn dữ liệu học tập. Nhận file **CSV** và **Excel `.xlsx`** (đọc sheet đầu tiên).

## ImportBatch

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| dataType | String(40) | NOT NULL | | Kiểu TS `ImportDataType` (union + Zod, KHÔNG dùng enum Postgres — xem `01`): `STUDENT`/`ATTENDANCE_SUMMARY`/`LMS_QUIZ`/`COURSE_RESULT` |
| termId | String(10) | NULL | FK → Term | Bắt buộc với mọi loại trừ `STUDENT`. Chọn trên form nhập, mặc định học kỳ `isCurrent` |
| source | ImportSource (enum) | NOT NULL | | `FILE` (MVP chỉ nhập file CSV/XLSX). Tên enum `ImportSource` để tránh trùng class `DataSource` của TypeORM |
| fileName | String(255) | NOT NULL | | Tên file gốc người dùng tải lên (chỉ hiển thị) |
| sourceChecksum | String(64) | NOT NULL | | SHA-256 nội dung file — chống nạp trùng (xem RÀNG BUỘC) |
| performedBy | String(20) | NOT NULL | FK → User | |
| status | ImportBatchStatus (enum) | NOT NULL | | `UPLOADING`→`VALIDATING`→`STAGED`→`LOADED`→`RECONCILED` / `REJECTED` / `DISCARDED` |
| totalRows | Int | NOT NULL | | |
| successRows | Int | NOT NULL | | |
| errorRows | Int | NOT NULL | | |
| warnings | Json | NULL | | Cảnh báo không chặn nạp (VD `diem_chu` lệch `diem_tong_ket`): `[{ row, code, message }]`, tối đa 500 mục — validate Zod |
| summary | Json | NULL | | `columns` (header gốc theo thứ tự file — jsonb không giữ thứ tự khóa), `preview` (5 dòng đầu), `errorRate`, `confirmedAt/By`, `inserted/updated/unchanged`, `createdKeys` (khóa bản ghi lô tạo mới — dùng hoàn tác), `retried` — validate Zod |
| stagedAt | DateTime | NULL | | Lúc kiểm tra xong — tự hủy lô chờ quá 7 ngày |
| loadedAt | DateTime | NULL | | Lúc ghi xong — điều kiện hoàn tác lô |
| errorMessage | String (text) | NULL | | Lý do khi `REJECTED` (lỗi cả file) |
| parentBatchId | String (uuid) | NULL | FK → ImportBatch | Liên kết batch sửa lỗi với batch gốc |
| originalFilePath | String(255) | NOT NULL | | Lưu trong MinIO — xem `01-architecture.md` |
| createdAt | DateTime | NOT NULL | | |
| completedAt | DateTime | NULL | | |

Quy trình 2 bước (người dùng chọn) — trạng thái:
- `UPLOADING`: đang nhận file, lưu file gốc vào MinIO.
- `VALIDATING`: job `import-batch-process` đọc file theo stream, kiểm tra từng dòng, ghi `ImportErrorRow`. KHÔNG ghi dữ liệu nghiệp vụ.
- `STAGED`: kiểm tra xong, chờ Admin xem trước ("X dòng hợp lệ, Y dòng lỗi") rồi bấm **Xác nhận nạp** hoặc **Hủy** (`DISCARDED`).
- `LOADED`: đã ghi các dòng hợp lệ (đọc lại file gốc từ MinIO, không dùng bảng tạm), theo lô ≤ 500 dòng/transaction; mọi thao tác là upsert theo khóa nghiệp vụ → chạy lại an toàn khi job lỗi giữa chừng.
- `RECONCILED`: đã cập nhật xong dữ liệu dẫn xuất (`Course.credits`, `attemptOutcome`, `enrollmentStatus`, tính lại `attemptNumber`) → từ Phase 4 kích hoạt `EvaluationRun` `AUTO_AFTER_IMPORT`.
- `REJECTED`: lỗi cả file — không đọc được, thiếu cột bắt buộc, không có dòng hợp lệ nào, học kỳ đã chốt. Ghi `errorMessage`.
- `ROLLED_BACK`: lô đã nạp bị hoàn tác (xem "Hoàn tác lô").

RÀNG BUỘC:
- Chỉ hủy được (`DISCARDED`) khi `status = STAGED` (chưa ghi dữ liệu nghiệp vụ nào). Lô `STAGED` quá 7 ngày không xác nhận → tự `DISCARDED` (job hằng ngày).
- **Kiểm tra lại khi xác nhận**: bước `LOADED` MUST kiểm tra lại mọi dòng với dữ liệu nền tại thời điểm nạp (sinh viên, lớp, học kỳ có thể đã đổi từ lúc xem trước); dòng mới thành lỗi được thêm vào `ImportErrorRow`, `successRows`/`errorRows` cập nhật lại.
- **Màn xem trước**: hiện số dòng hợp lệ/lỗi, vài dòng mẫu; tỷ lệ lỗi > 10% → cảnh báo nổi bật (với `LMS_QUIZ`, thiếu dòng làm lệch tỷ lệ "phần lớn lớp đã làm" của `LMS-01`).
- **Nạp đồng thời**: bước nạp giữ khóa theo `(dataType, termId)` (PostgreSQL advisory lock) — lô thứ hai cùng loại, cùng học kỳ chờ lô đầu xong.
- **Giới hạn file**: ≤ 20MB tải lên, ≤ 50.000 dòng dữ liệu (CSV và XLSX); XLSX: dung lượng sau giải nén ≤ 100MB (chống zip bomb), chỉ đọc giá trị ô (bỏ công thức, macro, sheet khác). Vượt → `REJECTED`.

**Hoàn tác lô** (người dùng chọn "có điều kiện") — Admin bấm "Hoàn tác" trên lô `LOADED`/`RECONCILED`, xác nhận lần 2 (AlertDialog), chỉ khi ĐỦ cả 2 điều kiện (người dùng bỏ điều kiện "chưa có `EvaluationRun`" vì mỗi lô nạp xong đều tự chạy đánh giá, điều kiện đó khiến lô học tập không bao giờ hoàn tác được):
1. Lô chỉ THÊM dòng mới, không cập nhật dòng có sẵn (`summary.updated = 0`), và job nạp không phải chạy lại sau sự cố (`summary.retried` khác true).
2. Không dòng nào của lô đã bị lô khác cập nhật sau đó (`importBatchId` của mọi dòng vẫn là lô này).
Hoàn tác = trong 1 transaction: xóa các dòng nguồn lô đã tạo; xóa `Enrollment` có `firstSeenBatchId` = lô và không còn dữ liệu nguồn nào; với lô `STUDENT`: xóa `Student`/`User` lô đã tạo nếu chưa đăng nhập lần nào (`authUserId` NULL) và chưa có dữ liệu học tập; tính lại dữ liệu dẫn xuất (`attemptOutcome`, `attemptNumber`); `status = ROLLED_BACK`; ghi Audit Log `IMPORT_ROLLED_BACK`; với lô dữ liệu học tập: tạo `EvaluationRun` (`AUTO_AFTER_IMPORT`, `importBatchId` = lô) để đánh giá lại — `RuleTrigger` cũ giữ làm lịch sử; từ Phase 5, `Alert` không còn trigger mới nào ở lần chạy lại được hệ thống chuyển `INVALIDATED` (`changedBy` NULL, lý do "dữ liệu nguồn đã được hoàn tác"). Không đủ điều kiện → nút bị vô hiệu kèm lý do; cách sửa là nạp file đúng (ghi đè) và Cố vấn học tập đánh dấu cảnh báo sai là "không còn hiệu lực" (`INVALIDATED`).
- Chống nạp trùng: partial unique index `(sourceChecksum, dataType, COALESCE(termId, ''))` `WHERE status NOT IN ('REJECTED', 'DISCARDED', 'ROLLED_BACK')` — file đã bị từ chối/hủy/hoàn tác được nạp lại.
- BullMQ `jobId` = `ImportBatch.id` (mỗi lô 1 mã; trùng file đã chặn ở DB). Job xác nhận nạp dùng `${id}-load` (BullMQ không cho dấu `:` trong jobId). Queue nhập chạy 1 job/lần (`05`).
- Partial unique index chống trùng loại trừ cả `ROLLED_BACK` (file đã hoàn tác được nạp lại).
- Học kỳ đã chốt (`closedAt` khác NULL) → từ chối MỌI loại nhập có `termId`.

## ImportErrorRow

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch | |
| sourceRowNumber | Int | NOT NULL | | Số dòng trong file gốc, để người nhập đối chiếu khi sửa |
| rawData | Json | NOT NULL | | Dữ liệu nguyên trạng dòng lỗi |
| errorDetail | String(255) | NULL | | Diễn giải cụ thể bằng tiếng Việt (VD "Lớp KTPM9999 chưa có trong hệ thống") |
| errorReason | String(40) | NOT NULL | | Kiểu TS `ImportErrorReason` (union + Zod, KHÔNG dùng enum Postgres — xem `01`): `INVALID_FORMAT`/`STUDENT_NOT_FOUND`/`CLASS_NOT_FOUND`/`DUPLICATE`/`OUT_OF_RANGE`/`TERM_MISMATCH`/`RESULT_ALREADY_FINAL` |
| resolved | Boolean | NOT NULL, default `false` | | |

`STUDENT_NOT_FOUND`: `mssv` chưa có trong danh sách sinh viên — MUST NOT tự tạo sinh viên. `TERM_MISMATCH`: cột `hoc_ky` khác học kỳ đã chọn, hoặc ngày chốt điểm danh / giờ bắt đầu làm bài nằm ngoài thời gian học kỳ. `DUPLICATE`: trùng khóa với 1 dòng trước đó trong CÙNG file (giữ dòng đầu), hoặc email sinh viên đã thuộc tài khoản khác. `RESULT_ALREADY_FINAL`: dòng chỉ có điểm quá trình cho kết quả đã chốt cuối kỳ.

**File lỗi tải về** (Route Handler GET — export file, chỉ Admin): CSV UTF-8 có BOM (Excel mở đúng tiếng Việt), chống chèn công thức (xem `06`), cột `dong` (số dòng gốc), `ly_do` (diễn giải tiếng Việt), `ma_loi`, rồi các cột gốc của dòng — sửa xong nạp lại được ngay (batch mới có `parentBatchId`).

## Định dạng file và cột — header tiếng Việt không dấu

**File mẫu** (`public/templates/`): mỗi loại có `.xlsx` (khuyên dùng — Excel giữ đúng tiếng Việt và ô ngày) và `.csv` UTF-8 CÓ BOM (Excel Windows mới nhận đúng tiếng Việt). `.xlsx` sinh từ `.csv` bằng `npm run templates:build` — sửa file `.csv` rồi chạy lại lệnh. File demo `docs/demo-data/*.csv` cũng có BOM. Tên (họ tên, tên học phần, tên bài) chứa `?` hoặc ký tự U+FFFD → `INVALID_FORMAT` kèm hướng dẫn: dấu hiệu Excel đã lưu CSV sai bảng mã ("CSV (Comma delimited)" thay vì "CSV UTF-8").

**Kiểm tra file trước khi đọc** (`06`): đuôi `.csv`/`.xlsx` + nội dung thật (CSV: văn bản, không có byte NUL; XLSX: chữ ký ZIP) + ≤ 20MB. KHÔNG dựa vào MIME trình duyệt gửi (Windows gửi CSV dạng `application/vnd.ms-excel`).

**Đọc CSV** (RFC 4180): bỏ BOM; tự nhận dấu phân cách `,` hoặc `;` (Excel máy tiếng Việt hay lưu `;`); khi phân cách là `;`, số thập phân dạng `7,5` được hiểu là 7.5. **Đọc XLSX**: sheet đầu tiên, dòng 1 là header; ô ngày kiểu Excel đọc theo giá trị ngày, ô văn bản đọc như CSV. Đọc theo stream (`05`).

**Header**: bỏ dấu, chữ thường, ký tự khác chữ/số → `_` rồi so khớp tên chuẩn (VD `Mã học phần` → `ma_hoc_phan`) + vài bí danh phổ biến (`ma_sv`, `ma_so_sinh_vien` → `mssv`). Thiếu cột bắt buộc → `REJECTED` cả file, báo rõ cột thiếu.

Học kỳ chọn trên form nhập (mặc định học kỳ hiện tại); cột `hoc_ky` là tùy chọn, nếu có MUST khớp. Ngày: `YYYY-MM-DD` hoặc `DD/MM/YYYY` với ngày và tháng đủ 2 chữ số (VD `05/10/2026`); ngày giờ: `YYYY-MM-DD HH:mm`, `DD/MM/YYYY HH:mm`, `HH:mm DD/MM/YYYY`. Dạng không đủ 2 chữ số mà ngày, tháng đều ≤ 12 và khác nhau (VD `10/2/2026` — Excel máy cài kiểu Mỹ tự đổi) hoặc tháng > 12 (VD `9/14/2026`) MUST báo `INVALID_FORMAT` với hướng dẫn dùng `YYYY-MM-DD` — KHÔNG đoán. Ô ngày trong XLSX đọc theo giá trị ngày của Excel. Số dòng báo lỗi = số dòng thật trong file (header = dòng 1). Parser MUST chấp nhận thêm dạng xuất phổ biến của LMS Việt Nam: `HH:mm DD/MM/YYYY`, điểm `8/10`, thời lượng `12 phút`, trạng thái tiếng Việt (`Đã nộp`, `Đạt`, `Không đạt`) — chuẩn hóa về kiểu ở `10` trước khi validate. Cột thừa (VD: `ho_ten`, `lop`) được bỏ qua, không báo lỗi.

- `STUDENT`: `mssv,ho_ten,email,ma_lop_sinh_hoat,trang_thai_hoc_vu`. Lớp sinh hoạt MUST tồn tại (sai → `CLASS_NOT_FOUND`). Email MUST đuôi `@student.ctuet.edu.vn` (sai → `INVALID_FORMAT`). `trang_thai_hoc_vu` ∈ `OfficialAcademicStatus` (chấp nhận nhãn tiếng Việt: Đang học/Bảo lưu/Đình chỉ/Tốt nghiệp/Buộc thôi học). Tạo/cập nhật `Student` + `User` (`role = STUDENT`, `accountStatus = ACTIVE`, `authUserId = NULL`); sinh viên không có trong file KHÔNG bị xóa. Đây là đường DUY NHẤT ghi `Student.officialAcademicStatus`.
- `ATTENDANCE_SUMMARY`: `mssv,ma_hoc_phan,ten_hoc_phan,ngay_chot,tong_buoi,co_mat,di_tre,vang_co_phep,vang_khong_phep` + tùy chọn `tong_buoi_ke_hoach,ma_lop_hoc_phan`. → `AttendanceSummary`.
- `LMS_QUIZ`: `mssv,ma_hoc_phan,ma_bai,ten_bai,lan_lam,thoi_diem_bat_dau,thoi_diem_nop,thoi_gian_lam_phut,diem,diem_toi_da,trang_thai` + tùy chọn `ma_lop_hoc_phan`, `ten_hoc_phan` (file LMS thường không có tên học phần — học phần mới tạm lấy tên = mã, được thay khi file điểm danh/kết quả có tên thật). `trang_thai`: `SUBMITTED`/`IN_PROGRESS`/`ABANDONED` (chấp nhận `Đã nộp`/`Đang làm`/`Bỏ dở`). `ma_bai` trống → dùng `ten_bai` chuẩn hóa làm khóa. → `LmsQuizAttempt`.
- `COURSE_RESULT`: `mssv,ma_hoc_phan,ten_hoc_phan,so_tin_chi,diem_qua_trinh,diem_thi,diem_tong_ket,diem_chu,ket_qua` + tùy chọn `ngay_cong_bo`. `ket_qua`: `DAT`/`KHONG_DAT` (chấp nhận `Đạt`/`Không đạt`). Chỉ có `diem_qua_trinh` → `PROCESS_ONLY`; có `diem_tong_ket`, `diem_chu` hoặc `ket_qua` → `FINAL`; không có điểm nào → `INVALID_FORMAT`. `so_tin_chi` 1–30 (trống = không đổi). → `CourseResult`, cập nhật `Course.credits`. Cảnh báo (`warnings`, không chặn nạp): `LETTER_GRADE_MISMATCH` (`diem_chu` lệch `diem_tong_ket`, nạp theo `diem_chu`), `RESULT_MISMATCH` (`ket_qua` lệch điểm chữ, nạp theo `ket_qua`).

Ánh xạ cột → field (`10`): `ngay_chot`→`snapshotDate`, `tong_buoi`→`totalSessions`, `tong_buoi_ke_hoach`→`plannedSessions`, `co_mat`→`present`, `di_tre`→`late`, `vang_co_phep`→`excusedAbsence`, `vang_khong_phep`→`unexcusedAbsence`, `ma_lop_hoc_phan`→`sectionCode`; `ma_bai`→`quizKey`, `ten_bai`→`quizName`, `lan_lam`→`attemptNumber`, `thoi_diem_bat_dau`→`startedAt`, `thoi_diem_nop`→`submittedAt`, `thoi_gian_lam_phut`→`durationMinutes`, `diem`→`score`, `diem_toi_da`→`maxScore`, `trang_thai`→`status`; `diem_qua_trinh`→`processScore`, `diem_thi`→`examScore`, `diem_tong_ket`→`finalScore`, `diem_chu`→`letterGrade`, `ket_qua`→`passed`, `ngay_cong_bo`→`publishedAt`, `so_tin_chi`→`Course.credits`.

Cả 3 loại học tập nhận thêm cột tùy chọn `hoc_ky` (khớp học kỳ đã chọn, sai → `TERM_MISMATCH`). Với 3 loại sau `STUDENT`: dòng hợp lệ đầu tiên của `(mssv, ma_hoc_phan)` trong học kỳ MUST upsert `Course` và tạo `Enrollment` nếu chưa có (xem `09-data-schema-identity.md`), trong cùng transaction với việc nạp dòng.

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
