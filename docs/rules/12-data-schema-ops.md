# 12 — Data Schema Reference: Import & Operational Exceptions

Xem `00-project-context.md` trước. File này đặc tả các bảng vận hành của module `data-import` (`ImportBatch`, `ImportErrorRow`) và checklist chức năng nhập file. Có 5 loại nhập: danh sách sinh viên + 4 nguồn dữ liệu học tập (điểm danh, bài trắc nghiệm, bài thực hành, kết quả học phần — Phase 8a, chốt 2026-10-18). Nhận file **CSV** và **Excel `.xlsx`** (đọc sheet đầu tiên).

## ImportBatch

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| dataType | String(40) | NOT NULL | | Kiểu TS `ImportDataType` (union + Zod, KHÔNG dùng enum Postgres — xem `01`): `STUDENT`/`ATTENDANCE_SUMMARY`/`LMS_QUIZ`/`LMS_ASSIGNMENT`/`COURSE_RESULT` |
| courseId | String(20) | NULL | FK → Course | Học phần Admin chọn trên form (tùy chọn, mặc định "tự nhận diện từ file") — có thì dòng thuộc học phần khác → `COURSE_MISMATCH` |
| termId | String(10) | NULL | FK → Term | Bắt buộc với mọi loại trừ `STUDENT`. Chọn trên form nhập, mặc định học kỳ `isCurrent` |
| source | ImportSource (enum) | NOT NULL | | `FILE` (MVP chỉ nhập file CSV/XLSX). Tên enum `ImportSource` để tránh trùng class `DataSource` của TypeORM |
| fileName | String(255) | NOT NULL | | Tên file đầu tiên của lô (chỉ hiển thị; lô nhiều file hiện thêm "+ N file") |
| sourceChecksum | String(64) | NOT NULL | | SHA-256 nội dung file (lô 1 file) / SHA-256 của danh sách checksum các file đã sắp xếp (lô nhiều file) — chống nạp trùng (xem RÀNG BUỘC) |
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
| originalFilePath | String(255) | NOT NULL | | File đầu tiên trong MinIO — xem `01-architecture.md`; danh sách đầy đủ ở `ImportBatchFile` |
| createdAt | DateTime | NOT NULL | | |
| completedAt | DateTime | NULL | | |

Quy trình 2 bước (người dùng chọn) — trạng thái:
- `UPLOADING`: đang nhận file, lưu file gốc vào MinIO. Lô nhiều file: trình duyệt gửi lần lượt từng file (mỗi lần ≤ 20MB — giới hạn thân request Server Action), file cuối kèm cờ kết thúc → `VALIDATING`. Lô `UPLOADING` quá 1 ngày (tải lên dở) → tự `DISCARDED`.
- `VALIDATING`: job `import-batch-process` đọc file theo stream, kiểm tra từng dòng, ghi `ImportErrorRow`. KHÔNG ghi dữ liệu nghiệp vụ.
- `STAGED`: kiểm tra xong, chờ Admin xem trước ("X dòng hợp lệ, Y dòng lỗi") rồi bấm **Xác nhận nạp** hoặc **Hủy** (`DISCARDED`).
- `LOADED`: đã ghi các dòng hợp lệ (đọc lại file gốc từ MinIO, không dùng bảng tạm), theo lô ≤ 500 dòng/transaction; mọi thao tác là upsert theo khóa nghiệp vụ → chạy lại an toàn khi job lỗi giữa chừng.
- `RECONCILED`: đã cập nhật xong dữ liệu dẫn xuất (`Course.credits`, `attemptOutcome`, `enrollmentStatus`, tính lại `attemptNumber`) → từ Phase 4 kích hoạt `EvaluationRun` `AUTO_AFTER_IMPORT`.
- `REJECTED`: lỗi cả file — không đọc được, thiếu cột bắt buộc, không có dòng hợp lệ nào, học kỳ đã chốt. Ghi `errorMessage`.
- `ROLLED_BACK`: lô đã nạp bị hoàn tác (xem "Hoàn tác lô").

RÀNG BUỘC:
- Chỉ hủy được (`DISCARDED`) khi `status = STAGED` hoặc `UPLOADING` (chưa ghi dữ liệu nghiệp vụ nào). Lô `STAGED` quá 7 ngày không xác nhận → tự `DISCARDED` (job hằng ngày).
- **Kiểm tra lại khi xác nhận**: bước `LOADED` MUST kiểm tra lại mọi dòng với dữ liệu nền tại thời điểm nạp (sinh viên, lớp, học kỳ có thể đã đổi từ lúc xem trước); dòng mới thành lỗi được thêm vào `ImportErrorRow`, `successRows`/`errorRows` cập nhật lại.
- **Màn xem trước**: hiện số dòng hợp lệ/lỗi, vài dòng mẫu; tỷ lệ lỗi > 10% → cảnh báo nổi bật (với `LMS_QUIZ`, thiếu dòng làm lệch tỷ lệ "phần lớn lớp đã làm" của `LMS-01`).
- **Thẻ nhận diện** (chốt 2026-10-18): màn xem trước hiện 1 thẻ cho mỗi học phần trong file — tên, mã lớp học phần, mã học phần (ghi "tự suy" nếu suy từ mã lớp học phần), số tiết / danh sách bài + hạn nộp / ngày chốt (kèm ngày chốt lần nạp trước), số sinh viên chia theo lớp sinh hoạt và khoa, nhãn "Khớp học kỳ" / "Học phần mới, sẽ tạo", số dòng lỗi và cảnh báo của học phần đó. Lưu ở `summary.courses` (validate Zod). Nút xác nhận ghi rõ số dòng sẽ nạp. KHÔNG chọn khoa/lớp sinh hoạt khi nạp (1 lớp học phần có sinh viên nhiều lớp, nhiều khoa). Lịch sử nạp có cột Học phần (khi lô chỉ có 1 học phần) và lọc theo học phần.
- **Nạp đồng thời**: bước nạp giữ khóa theo `(dataType, termId)` (PostgreSQL advisory lock) — lô thứ hai cùng loại, cùng học kỳ chờ lô đầu xong.
- **Giới hạn file**: ≤ 20MB mỗi file, ≤ 50 file mỗi lô, ≤ 50.000 dòng dữ liệu TỔNG cả lô (CSV và XLSX); XLSX: dung lượng sau giải nén ≤ 100MB (chống zip bomb), chỉ đọc giá trị ô (bỏ công thức, macro, sheet khác). Vượt → `REJECTED`. Giới hạn tần suất: 30 lô / giờ / Admin (đếm theo lô, không theo file).
- **Nạp nhiều file 1 lần** (chốt 2026-10-20, Phase 8f — trường xuất 1 file / lớp học phần / lần): 1 lô nhận 1–50 file CÙNG loại, CÙNG học kỳ (được trộn `.csv` và `.xlsx`; mỗi file có dòng tiêu đề và thứ tự cột riêng). Cả lô chung 1 lần xem trước, 1 lần xác nhận, 1 lần chạy đánh giá sau nạp, hoàn tác cả lô. 1 file lỗi cả file (không đọc được, thiếu cột) → `REJECTED` cả lô, `errorMessage` ghi tên file. Kiểm tra trùng khóa chạy xuyên các file: dòng trùng dòng của file trước → `DUPLICATE` "Trùng với dòng N của file X". Chống nạp trùng theo TỪNG file: file đã nằm trong 1 lô còn hiệu lực khác (cùng loại, học kỳ) hoặc chọn 2 lần trong cùng lô → từ chối khi tải lên. Màn xem trước có bảng từng file (số dòng, hợp lệ, lỗi, học phần nhận diện) + thẻ học phần gộp cả lô. Lịch sử nạp lọc theo học phần (học phần chọn trên form hoặc nhận diện trong `summary.courses`) và theo khoa (khoa của lớp sinh hoạt trong thẻ học phần).

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
| sourceFileName | String(255) | NULL | | Tên file chứa dòng lỗi (lô nhiều file — Phase 8f); NULL ở lô cũ trước 8f |
| rawData | Json | NOT NULL | | Dữ liệu nguyên trạng dòng lỗi |
| errorDetail | String(255) | NULL | | Diễn giải cụ thể bằng tiếng Việt (VD "Lớp KTPM9999 chưa có trong hệ thống") |
| errorReason | String(40) | NOT NULL | | Kiểu TS `ImportErrorReason` (union + Zod, KHÔNG dùng enum Postgres — xem `01`): `INVALID_FORMAT`/`STUDENT_NOT_FOUND`/`CLASS_NOT_FOUND`/`DUPLICATE`/`OUT_OF_RANGE`/`TERM_MISMATCH`/`COURSE_MISMATCH` |
| resolved | Boolean | NOT NULL, default `false` | | |

`STUDENT_NOT_FOUND`: `mssv` chưa có trong danh sách sinh viên — MUST NOT tự tạo sinh viên. `TERM_MISMATCH`: cột `hoc_ky` khác học kỳ đã chọn, hoặc ngày chốt điểm danh / giờ bắt đầu làm bài nằm ngoài thời gian học kỳ. `DUPLICATE`: trùng khóa với 1 dòng trước đó trong CÙNG lô (cùng file hoặc file trước — giữ dòng đầu), hoặc email sinh viên đã thuộc tài khoản khác. `COURSE_MISMATCH`: Admin đã chọn 1 học phần trên form nhưng dòng thuộc học phần khác.

**File lỗi tải về** (Route Handler GET — export file, chỉ Admin): CSV UTF-8 có BOM (Excel mở đúng tiếng Việt), chống chèn công thức (xem `06`), cột `dong` (số dòng gốc), `ly_do` (diễn giải tiếng Việt), `ma_loi`, (lô nhiều file: `ten_file`), rồi các cột gốc của dòng — sửa xong nạp lại được ngay (batch mới có `parentBatchId`; các cột thêm được bỏ qua).

## ImportBatchFile (Phase 8f)

1 file của 1 lô. Lô trước 8f được migration điền 1 dòng từ cột của `ImportBatch`.

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| importBatchId | String (uuid) | NOT NULL | FK → ImportBatch (CASCADE) | |
| fileOrder | Int | NOT NULL | UNIQUE cùng `importBatchId` | Thứ tự tải lên, từ 1 |
| fileName | String(255) | NOT NULL | | |
| sourceChecksum | String(64) | NOT NULL | INDEX | SHA-256 nội dung file — chống nạp trùng từng file |
| originalFilePath | String(255) | NOT NULL | | Khóa đối tượng MinIO |
| sizeBytes | Int | NOT NULL | | |
| totalRows / successRows / errorRows | Int | NOT NULL, default 0 | | Cập nhật sau kiểm tra và sau nạp |
| courseIds | String(20)[] | NOT NULL, default `{}` | | Học phần nhận diện trong file (bảng từng file ở màn xem trước) |
| createdAt | DateTime | NOT NULL | | |

## Định dạng file và cột — header tiếng Việt không dấu

**File mẫu** (`public/templates/`): mỗi loại có `.xlsx` (khuyên dùng — Excel giữ đúng tiếng Việt và ô ngày) và `.csv` UTF-8 CÓ BOM (Excel Windows mới nhận đúng tiếng Việt). `.xlsx` sinh từ `.csv` bằng `npm run templates:build` — sửa file `.csv` rồi chạy lại lệnh. File demo `docs/demo-data/*.csv` cũng có BOM. Tên (họ tên, tên học phần, tên bài) chứa `?` hoặc ký tự U+FFFD → `INVALID_FORMAT` kèm hướng dẫn: dấu hiệu Excel đã lưu CSV sai bảng mã ("CSV (Comma delimited)" thay vì "CSV UTF-8").

**Kiểm tra file trước khi đọc** (`06`): đuôi `.csv`/`.xlsx` + nội dung thật (CSV: văn bản, không có byte NUL; XLSX: chữ ký ZIP) + ≤ 20MB. KHÔNG dựa vào MIME trình duyệt gửi (Windows gửi CSV dạng `application/vnd.ms-excel`).

**Đọc CSV** (RFC 4180): bỏ BOM; tự nhận dấu phân cách `,` hoặc `;` (Excel máy tiếng Việt hay lưu `;`); khi phân cách là `;`, số thập phân dạng `7,5` được hiểu là 7.5. **Đọc XLSX**: sheet đầu tiên, dòng 1 là header; ô ngày kiểu Excel đọc theo giá trị ngày, ô văn bản đọc như CSV. Đọc theo stream (`05`).

**Dòng tiêu đề**: dòng đầu tiên trong 10 dòng đầu chứa cột `mssv` (hoặc bí danh) — để dán cả vùng bảng có dòng tiêu đề phụ phía trên; số dòng báo lỗi vẫn là số dòng thật. **Header**: bỏ dấu, chữ thường, ký tự khác chữ/số → `_` rồi so khớp tên chuẩn (VD `Mã học phần` → `ma_hoc_phan`) + vài bí danh phổ biến (`ma_sv`, `ma_so_sinh_vien` → `mssv`). Thiếu cột bắt buộc → `REJECTED` cả file, báo rõ cột thiếu.

Học kỳ chọn trên form nhập (mặc định học kỳ hiện tại); cột `hoc_ky` là tùy chọn, nếu có MUST khớp. Ngày: `YYYY-MM-DD` hoặc `DD/MM/YYYY` với ngày và tháng đủ 2 chữ số (VD `05/10/2026`); ngày giờ: `YYYY-MM-DD HH:mm`, `DD/MM/YYYY HH:mm`, `HH:mm DD/MM/YYYY`. Dạng không đủ 2 chữ số mà ngày, tháng đều ≤ 12 và khác nhau (VD `10/2/2026` — Excel máy cài kiểu Mỹ tự đổi) hoặc tháng > 12 (VD `9/14/2026`) MUST báo `INVALID_FORMAT` với hướng dẫn dùng `YYYY-MM-DD` — KHÔNG đoán. Ô ngày trong XLSX đọc theo giá trị ngày của Excel. Số dòng báo lỗi = số dòng thật trong file (header = dòng 1). Parser MUST chấp nhận thêm dạng xuất phổ biến của LMS Việt Nam: `HH:mm DD/MM/YYYY`, điểm `8/10`, thời lượng `12 phút`, trạng thái tiếng Việt/Anh của Moodle (`Đã nộp`, `Nộp trễ`, `Chưa nộp`, `Chưa làm`, `Submitted for grading`, `No submission`, `Finished`, `Never submitted`) — chuẩn hóa về kiểu ở `10` trước khi validate. Cột thừa (VD: `lop`, `ngay_sinh`) được bỏ qua, không báo lỗi.

- `STUDENT`: `mssv,ho_ten,email,ma_lop_sinh_hoat,trang_thai_hoc_vu`. Lớp sinh hoạt MUST tồn tại (sai → `CLASS_NOT_FOUND`). Email MUST đuôi `@student.ctuet.edu.vn` (sai → `INVALID_FORMAT`). `trang_thai_hoc_vu` ∈ `OfficialAcademicStatus` (chấp nhận nhãn tiếng Việt: Đang học/Bảo lưu/Đình chỉ/Tốt nghiệp/Buộc thôi học). Tạo/cập nhật `Student` + `User` (`role = STUDENT`, `accountStatus = ACTIVE`, `authUserId = NULL`); sinh viên không có trong file KHÔNG bị xóa. Đây là đường DUY NHẤT ghi `Student.officialAcademicStatus`.
**Cột chung 4 loại học tập** (chốt 2026-10-18): `mssv`, `ma_lop_hoc_phan` (bắt buộc), tùy chọn `ma_hoc_phan` (trống → `ma_lop_hoc_phan` bỏ 2 ký tự cuối, VD `010100240802` → `0101002408` — giả định chưa xác nhận chính thức, màn xem trước ghi "tự suy"), `ho_dem` + `ten` (đối chiếu với `Student.fullName` sau khi bỏ dấu, chữ thường, gộp khoảng trắng — lệch → cảnh báo `NAME_MISMATCH` "có thể sai MSSV", không chặn), `hoc_ky` (khớp học kỳ đã chọn). Dòng hợp lệ đầu tiên của `(mssv, mã học phần)` trong học kỳ MUST upsert `Course` và tạo `Enrollment` nếu chưa có (`09`), cập nhật `Enrollment.sectionCode`, trong cùng transaction với việc nạp dòng.

- `ATTENDANCE_SUMMARY`: chung + `ten_hoc_phan, ngay_chot, tong_so_tiet, vang_co_phep, vang_khong_phep` + tùy chọn `ty_le_vang` (đối chiếu). Đơn vị TIẾT. → `AttendanceSummary`.
- `LMS_QUIZ`: chung + `ma_bai, ten_bai, trang_thai` + tùy chọn `ten_hoc_phan, han_nop, lan_lam, thoi_diem_bat_dau, thoi_diem_nop, thoi_gian_lam_phut, diem, diem_toi_da, so_cau_dung, tong_so_cau`. `trang_thai`: `SUBMITTED`/`IN_PROGRESS`/`ABANDONED`/`NOT_STARTED` (chấp nhận `Đã nộp`/`Đang làm`/`Bỏ dở`/`Chưa làm`, Moodle `Finished`/`In progress`/`Never submitted`). Khác `NOT_STARTED` thì `thoi_diem_bat_dau` bắt buộc. Học phần mới chưa có tên → tạm lấy tên = mã. → `LmsActivity` (QUIZ) + `LmsQuizAttempt`.
- `LMS_ASSIGNMENT`: chung + `ma_bai, ten_bai, han_nop, trang_thai_nop` + tùy chọn `ten_hoc_phan, thoi_diem_nop`. `trang_thai_nop`: `ON_TIME`/`LATE`/`NOT_SUBMITTED` (chấp nhận `Đã nộp`/`Nộp trễ`/`Chưa nộp`, Moodle `Submitted for grading`/`No submission`). `thoi_diem_nop` bắt buộc khi đã nộp. → `LmsActivity` (ASSIGNMENT) + `LmsAssignmentSubmission`.
- `COURSE_RESULT`: chung + `ten_hoc_phan, so_tin_chi, diem_chu` + tùy chọn `diem_thuong_xuyen, duoc_du_thi, diem_cuoi_ky, vang_thi, thang_diem_4, ngay_cong_bo`. `so_tin_chi` 1–30 (bắt buộc — file trường không có, Admin điền theo chương trình đào tạo). `duoc_du_thi`/`vang_thi`: `Có`/`Không` (chấp nhận `x`, `1`/`0`, `TRUE`/`FALSE`). Chỉ nạp khi học phần đã khóa điểm. → `CourseResult`, cập nhật `Course.credits`. Cảnh báo: `GRADE_POINT_MISMATCH` (`thang_diem_4` lệch quy đổi của `diem_chu`).

Ánh xạ cột → field (`10`): `ngay_chot`→`snapshotDate`, `tong_so_tiet`→`totalPeriods`, `vang_co_phep`→`excusedAbsence`, `vang_khong_phep`→`unexcusedAbsence`, `ma_lop_hoc_phan`→`sectionCode`; `ma_bai`→`activityKey`, `ten_bai`→`activityName`, `han_nop`→`dueAt`, `lan_lam`→`attemptNumber`, `thoi_diem_bat_dau`→`startedAt`, `thoi_diem_nop`→`submittedAt`, `thoi_gian_lam_phut`→`durationMinutes`, `diem`→`score`, `diem_toi_da`→`maxScore`, `so_cau_dung`→`correctCount`, `tong_so_cau`→`totalQuestions`, `trang_thai`→`status`, `trang_thai_nop`→`LmsAssignmentSubmission.status`; `diem_thuong_xuyen`→`processScore`, `diem_cuoi_ky`→`examScore`, `diem_chu`→`letterGrade`, `duoc_du_thi`→`eligibleForExam`, `vang_thi`→`absentFromExam`, `ngay_cong_bo`→`publishedAt`, `so_tin_chi`→`Course.credits`.

## Quan hệ tóm tắt

`ImportBatch 1—n ImportErrorRow` · `ImportBatch 1—n` (AttendanceSummary, LmsActivity, LmsQuizAttempt, LmsAssignmentSubmission, CourseResult — xem `10`) · `ImportBatch 0..1—n ImportBatch` (qua `parentBatchId`) · `ImportBatch n—0..1 Term`.

## Chức năng module data-import — checklist bắt buộc

1. Nhập danh sách sinh viên.
2. Nhập điểm danh tổng hợp theo ngày chốt.
3. Nhập kết quả bài trắc nghiệm LMS.
4. Nhập trạng thái nộp bài thực hành LMS.
5. Nhập kết quả học phần đã khóa điểm.
6. Xem lịch sử các lần nhập (danh sách `ImportBatch`) và số dòng thành công/lỗi.
7. Tải file dòng lỗi kèm lý do diễn giải tiếng Việt.
8. Nhập lại các dòng đã sửa, liên kết batch gốc (`parentBatchId`).
9. Chống nhập trùng file bằng `sourceChecksum`.
10. Hủy batch `STAGED` chưa được dùng để tính RiskScore.
11. Dữ liệu lỗi hoặc chưa đối soát MUST NOT vào Rule Engine (chỉ đọc dữ liệu từ batch `LOADED`/`RECONCILED`).
