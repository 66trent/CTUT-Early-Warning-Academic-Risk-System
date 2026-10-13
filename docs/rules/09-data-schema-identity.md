# 09 — Data Schema Reference: Identity & Enrollment

Xem `00-project-context.md` cho glossary/enum dùng chung. File này là đặc tả field-level để dịch trực tiếp sang entity TypeORM (`src/db/entities`) — MUST khớp chính xác tên field, kiểu dữ liệu, nullable, khóa. Phạm vi: 7 bảng nền tảng (danh mục + đăng ký học phần + lịch học).

## Quy ước kiểu → TypeORM (áp dụng cho cả `09`–`12`)

| Kiểu trong spec | TypeORM / PostgreSQL |
|---|---|
| `String(N)` | `type: 'varchar', length: N` |
| `String (uuid)` | `type: 'uuid'` (PK: `@PrimaryGeneratedColumn('uuid')`) |
| `String (text)` | `type: 'text'` |
| `Int` / `Float` / `Boolean` | `int` / `double precision` / `boolean` |
| `DateTime` / `DateTime (date)` | `timestamptz` / `date` |
| `Json` | `jsonb` (validate bằng Zod trước khi ghi) |
| `X (enum)` | `type: 'enum', enum: X` (enum khai báo ở `src/db/enums.ts`) |
| Cột "Null?" = NULL | `nullable: true` |
| "RÀNG BUỘC: UNIQUE (...)" | `@Index([...], { unique: true })` |

## User

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| userId | String(20) | NOT NULL | PK | `STUDENT`: = mã sinh viên. `ADVISOR`/`ADMIN`: mã cán bộ (nhập khi đăng ký, duy nhất; Admin sửa được trước khi duyệt). Admin đầu tiên do seed tạo có mã `ADMIN` |
| fullName | String(100) | NOT NULL | | |
| role | UserRole (enum) | NOT NULL | | `STUDENT`/`ADVISOR`/`ADMIN` |
| email | String(100) | NOT NULL | UNIQUE | Luôn lưu chữ thường (CHECK ở DB). `STUDENT`: MUST kết thúc `@student.ctuet.edu.vn` (CHECK ở DB). `ADVISOR`: MUST kết thúc bằng đuôi email cán bộ đọc từ biến môi trường `STAFF_EMAIL_DOMAIN` (giá trị `*` = mọi email trừ email sinh viên, chỉ dùng khi thử nghiệm — xem `06`). Validate bằng Zod ở server, không chỉ ở UI |
| accountStatus | UserAccountStatus (enum) | NOT NULL | | `PENDING_APPROVAL`/`ACTIVE`/`REJECTED`/`SUSPENDED`. Chỉ `ACTIVE` mới truy cập được dữ liệu |
| authUserId | String(64) | NULL | UNIQUE | Id tài khoản Better Auth (schema `auth`). Gán ở lần đăng nhập đầu tiên bằng cách khớp `email` |

RÀNG BUỘC liên kết Student–User: với mọi `Student`, `User` tương ứng có `role = STUDENT` và `User.userId = Student.studentId` (khóa nghiệp vụ). `User` của sinh viên được tạo khi Admin nhập danh sách sinh viên (`authUserId = NULL`), KHÔNG tạo khi đăng nhập. Đăng nhập Google mà email không khớp `User` nào có `role = STUDENT` → MUST từ chối, báo "Chưa có hồ sơ, liên hệ phòng Đào tạo". MUST NOT tự tạo `Student`/`User` mặc định.

## Department (Khoa)

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| departmentId | String(10) | NOT NULL | PK | VD: `K.CNTT` |
| departmentName | String(150) | NOT NULL | | |

Danh sách khoa nạp bằng seed (danh mục chính thức do người dùng cung cấp): `K.CNTT` Khoa Công nghệ thông tin · `K.DDT` Khoa Điện - Điện tử · `K.KTCK` Khoa Kỹ thuật Cơ khí · `K.KTXD` Khoa Kỹ thuật Xây dựng · `K.CNSH` Khoa Công nghệ sinh học - Công nghệ hóa học - Công nghệ thực phẩm · `K.KTQL` Khoa Kinh tế - Quản lý công nghiệp · `K.KHXH` Khoa Khoa học Xã hội. Admin chỉ xem, không có màn hình sửa.

## AdministrativeClass (Lớp sinh hoạt) — đơn vị gán CVHT

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| classId | String(20) | NOT NULL | PK | VD: `KTPM2311` |
| className | String(100) | NOT NULL | | |
| departmentId | String(10) | NOT NULL | FK → Department | |
| cohortYear | String(10) | NOT NULL | | Khóa tuyển sinh |
| advisorId | String(20) | NULL | FK → User.userId | CVHT chủ nhiệm. `User` phải có `role = ADVISOR` và `accountStatus = ACTIVE`. NULL = chưa gán |

Quản lý tài khoản cán bộ (Admin): trạng thái chỉ chuyển `PENDING_APPROVAL→ACTIVE` (duyệt), `PENDING_APPROVAL→REJECTED` (từ chối), `ACTIVE→SUSPENDED` (khóa), `SUSPENDED→ACTIVE` (mở khóa); vai trò chỉ đổi `ADVISOR↔ADMIN` khi `ACTIVE`; mã cán bộ sửa được khi `PENDING_APPROVAL`. MUST NOT tự thay đổi tài khoản của chính mình. CVHT đang phụ trách lớp MUST NOT bị khóa hay đổi vai trò — chuyển lớp cho người khác trước (giữ đúng ràng buộc `advisorId` là ADVISOR ACTIVE). Mọi thao tác ghi Audit Log.

RÀNG BUỘC: CVHT quản lý sinh viên QUA lớp sinh hoạt — phạm vi của `ADVISOR` là mọi `Student` có `classId` thuộc lớp có `advisorId` là mình. Đổi `advisorId` của 1 lớp MUST chạy trong 1 transaction: cập nhật lớp + chuyển `Alert.assignedAdvisorId` của mọi `Alert` đang mở (`OPEN`/`ACKNOWLEDGED`/`IN_PROGRESS`/`REOPENED`) của sinh viên lớp đó sang CVHT mới + ghi Audit Log.

## Student

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| studentId | String(20) | NOT NULL | PK | Mã số sinh viên |
| fullName | String(100) | NOT NULL | | |
| classId | String(20) | NOT NULL | FK → AdministrativeClass | Lớp sinh hoạt. Khoa, khóa, CVHT suy ra từ lớp — MUST NOT lưu lặp lại ở `Student`. Đổi lớp (qua nhập danh sách sinh viên) → từ Phase 5 MUST chuyển `Alert` đang mở của sinh viên đó sang CVHT của lớp mới trong cùng transaction |
| officialAcademicStatus | OfficialAcademicStatus (enum) | NOT NULL | | `ACTIVE`/`RESERVED`/`SUSPENDED`/`GRADUATED`/`DISMISSED`. MUST chỉ ghi bởi tiến trình nhập dữ liệu từ SIS (MVP: file CSV/seed), không do rule-engine/alerts/admin ghi — xem ràng buộc phạm vi ở `00-project-context.md` |

## Term

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| termId | String(10) | NOT NULL | PK | VD: `HK1_2026` = Học kỳ 1 năm học 2026–2027; `HK2_2025` = Học kỳ 2 năm học 2025–2026 |
| termName | String(50) | NOT NULL | | |
| academicYear | String(10) | NOT NULL | | |
| startDate | DateTime | NOT NULL | | |
| endDate | DateTime | NOT NULL | | Cùng `startDate` xác định cửa sổ quan sát cho RiskScore |
| isCurrent | Boolean | NOT NULL, default `false` | | Học kỳ đang hoạt động. MUST có partial unique index `WHERE is_current = true` (tối đa 1 học kỳ hiện tại). Đổi học kỳ hiện tại trong 1 transaction (bỏ cờ cũ → bật cờ mới); học kỳ đã chốt không đặt làm hiện tại được |
| closedAt | DateTime | NULL | | Thời điểm Admin chốt học kỳ sau khi nhập kết quả cuối kỳ. Học kỳ đã chốt MUST NOT nhận thêm dữ liệu điểm danh/LMS. Không mở lại được |

Tạo học kỳ: Admin chọn số học kỳ (1–3) + năm bắt đầu năm học → hệ thống sinh `termId` = `HK{n}_{năm}`, `termName` = "Học kỳ n, năm–năm+1", `academicYear` = "năm-năm+1". `startDate`/`endDate` nhập theo ngày, lưu 00:00 và 23:59:59 giờ Việt Nam (UTC+7).

## Course (Học phần)

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| courseId | String(20) | NOT NULL | PK | Mã học phần (`ma_hoc_phan`) |
| courseName | String(150) | NOT NULL | | |
| credits | Int | NULL | | Số tín chỉ. Điền khi nhập kết quả học phần; NULL thì học phần không được tính vào `ACA-03` |
| theoryPeriods | Int | NULL | | Số tiết lý thuyết — chỉ hiển thị, không dùng trong luật |
| practicePeriods | Int | NULL | | Số tiết thực hành — chỉ hiển thị, không dùng trong luật |

Tạo tự động (upsert theo `courseId`) khi một file nguồn nhắc tới mã học phần chưa có. File kết quả học phần có số tín chỉ thì cập nhật `credits`.

## Enrollment — sinh viên × học phần × học kỳ, bảng trung tâm

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| enrollmentId | String (uuid) | NOT NULL | PK | |
| studentId | String(20) | NOT NULL | FK → Student | |
| courseId | String(20) | NOT NULL | FK → Course | |
| termId | String(10) | NOT NULL | FK → Term | |
| enrollmentStatus | EnrollmentStatus (enum) | NOT NULL | | `REGISTERED` / `WITHDRAWN` (Admin đánh dấu tay ở hồ sơ sinh viên, bỏ đánh dấu được — cả 2 chiều ghi Audit Log `ENROLLMENT_WITHDRAWN`/`ENROLLMENT_WITHDRAWAL_UNDONE`; người dùng chốt 2026-10-13) / `COMPLETED` (khi có kết quả `FINAL`) |
| attemptNumber | Int | NOT NULL | | = 1 + số học kỳ TRƯỚC (theo `Term.startDate`) có `attemptOutcome = FAILED` cho cùng `(studentId, courseId)`. Tính khi tạo; tính lại khi kết quả `FINAL` của học kỳ trước thay đổi (xem `10`) |
| attemptOutcome | AttemptOutcome (enum) | NOT NULL, default `PENDING` | | `PENDING`/`PASSED`/`FAILED` — cập nhật từ `CourseResult` |
| firstSeenBatchId | String (uuid) | NOT NULL | FK → ImportBatch | Batch đầu tiên làm phát sinh bản ghi |
| createdAt | DateTime | NOT NULL | | |

RÀNG BUỘC:
- UNIQUE `(studentId, courseId, termId)`.
- KHÔNG có file "đăng ký học phần" riêng: `Enrollment` được TẠO TỰ ĐỘNG khi 1 dòng điểm danh, LMS hoặc kết quả đầu tiên của `(mssv, ma_hoc_phan)` được nạp vào học kỳ đã chọn. `mssv` chưa có trong `Student` → dòng lỗi `STUDENT_NOT_FOUND`, MUST NOT tự tạo sinh viên.
- Mọi bảng dữ liệu nguồn (`10-data-schema-source-records.md`) trỏ qua `enrollmentId`.

## Quan hệ (TypeORM relation) tóm tắt

`Student 1—n Enrollment` · `Course 1—n Enrollment` · `Term 1—n Enrollment` · `Student n—1 AdministrativeClass` · `AdministrativeClass n—1 Department` · `AdministrativeClass n—0..1 User` (qua `advisorId`) · `Enrollment n—1 ImportBatch` (qua `firstSeenBatchId`).
