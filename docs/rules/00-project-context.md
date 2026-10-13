# 00 — Project Context & Domain Glossary

Nguồn sự thật duy nhất về nghiệp vụ và mô hình dữ liệu của dự án. Mọi rule khác trong `docs/rules/` giả định agent đã đọc file này. Không định nghĩa lại các khái niệm dưới đây ở nơi khác — chỉ tham chiếu tên.

## Hệ thống là gì

CTUT-EWARS (Early Warning Academic Risk System): hệ thống phát hiện dấu hiệu rủi ro học tập của sinh viên dựa trên luật nghiệp vụ có thể cấu hình, tổng hợp từ 3 nguồn dữ liệu: điểm danh tổng hợp, kết quả bài kiểm tra LMS, kết quả học phần (bảng điểm). Bộ luật: `08-business-rules-catalog.md`.

Tên hiển thị của hệ thống (giao diện, email, tiêu đề trang) đọc từ biến môi trường `NEXT_PUBLIC_APP_NAME` — MUST NOT ghi cứng ở nhiều nơi.

## Ranh giới phạm vi — bất biến, không được vi phạm dưới bất kỳ lý do nào

Hệ thống CHỈ được: (1) phát hiện dấu hiệu, (2) tạo cảnh báo sớm, (3) gửi cảnh báo tới CVHT, (4) cho phép CVHT xác nhận/xử lý. ADMIN chỉ giám sát (chỉ đọc), không xử lý cảnh báo.

Hệ thống KHÔNG BAO GIỜ được tự động ghi hoặc sửa trạng thái học vụ chính thức của sinh viên (`Student.officialAcademicStatus`). Trường này chỉ được cập nhật một chiều từ hệ thống quản lý đào tạo (SIS) bên ngoài. Mọi cảnh báo do hệ thống tạo ra là tham khảo (`Alert.isReferenceOnly = true`), không phải quyết định hành chính.

## Tech stack

Next.js 16 (App Router, fullstack) · PostgreSQL · TypeORM · Better Auth · BullMQ + Redis (job nền) · Rule Engine tự viết (không dùng thư viện luật ngoài) · Tailwind CSS 4 + shadcn/ui · Recharts qua shadcn Chart (biểu đồ) · Nodemailer + SMTP nội bộ · Docker.

Phiên bản chốt ở Phase 0: Node 22 · TypeScript 5.9 (chưa dùng TS 7) · TypeORM 0.3.x (chưa dùng 1.x — cần kiểm chứng decorator) · Zod 4 · BullMQ 6 · Tailwind 4 · ESLint 9. Biểu đồ: Recharts + component `Chart` của shadcn/ui (người dùng chốt 2026-10-13 — Tremor 3 chỉ nhận React 18, dự án dùng React 19).

## Vai trò người dùng (roles) và phạm vi truy cập dữ liệu

| Role             | Phạm vi được xem/sửa                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `STUDENT`        | Chỉ dữ liệu của chính mình (`Student.id === session.user.studentId`)                                                                                                                                   |
| `ADVISOR` (CVHT) | Chỉ sinh viên thuộc lớp sinh hoạt có `AdministrativeClass.advisorId === session.user.id` tại thời điểm hiện tại; xử lý `Alert`, ghi `Intervention`                                                     |
| `ADMIN`          | Quản trị tài khoản, nhập CSV, cấu hình + chạy thử + kích hoạt luật, xem toàn bộ cảnh báo ở chế độ CHỈ ĐỌC (không xử lý `Alert`, không ghi `Intervention`). KHÔNG có quyền ghi `officialAcademicStatus` |

Cách có tài khoản: `STUDENT` chỉ đăng nhập Google OAuth bằng email `@student.ctuet.edu.vn`, và chỉ khi Admin đã nhập hồ sơ. `ADVISOR` tự đăng ký ở trang đăng nhập → `PENDING_APPROVAL` → Admin duyệt. `ADMIN` đầu tiên tạo bằng seed (thông tin đọc từ biến môi trường); Admin khác do Admin tạo. Không ai tự chọn vai trò khi đăng ký.

## Quy trình vận hành — thứ tự dữ liệu bắt buộc

1. Dữ liệu nền (đầu khóa): Khoa (seed) → duyệt CVHT → Lớp sinh hoạt + gán CVHT → nhập Sinh viên.
2. Mỗi học kỳ: tạo `Term` + đặt `isCurrent`. KHÔNG nhập lớp học phần hay đăng ký học phần riêng — `Course` và `Enrollment` tự sinh từ dữ liệu nguồn.
3. Trong học kỳ (hằng tuần): nhập điểm danh tổng hợp + kết quả bài kiểm tra LMS; giữa kỳ nhập điểm quá trình → chạy đánh giá → `Alert` → CVHT xử lý → sinh viên xem.
4. Cuối kỳ: nhập kết quả học phần đầy đủ (`FINAL`) → chạy đánh giá (`ACA-02`, `ACA-03`) → chốt học kỳ (`closedAt`). Kết quả `FAILED` là căn cứ nhận diện học lại ở học kỳ sau (`COMB-02`).

Mỗi bước MUST từ chối dữ liệu tham chiếu tới thứ chưa tồn tại ở bước trước (VD: `mssv` chưa có trong danh sách sinh viên), ghi vào `ImportErrorRow`. Ngoại lệ duy nhất được tự tạo: `Course` và `Enrollment` (xem `09`).

## Mô hình dữ liệu cốt lõi (entity glossary)

| Entity                               | Định nghĩa                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Department` / `AdministrativeClass` | Khoa / lớp sinh hoạt (VD: `KTPM2311`). CVHT được gán ở cấp lớp sinh hoạt.                                                                                                                                                                                                           |
| `Student`                            | Hồ sơ sinh viên, thuộc 1 lớp sinh hoạt. `officialAcademicStatus` là bản sao chỉ-đọc từ SIS.                                                                                                                                                                                         |
| `Enrollment`                         | Sinh viên × học phần × học kỳ, tự sinh khi dữ liệu nguồn đầu tiên của cặp `(mssv, ma_hoc_phan)` được nạp. Có `attemptNumber` (lần học thứ mấy, tính từ các lần rớt trước) và `enrollmentStatus` (`REGISTERED`/`WITHDRAWN`/`COMPLETED`). **Mọi dữ liệu nguồn trỏ qua `Enrollment`.** |
| `Course`                             | Học phần (mã, tên, số tín chỉ). Không quản lý lớp học phần hay lịch học.                                                                                                                                                                                                            |
| `AttendanceSummary`                  | Số liệu điểm danh tổng hợp của 1 `Enrollment` tại 1 ngày chốt: tổng buổi đã học, có mặt, trễ, vắng có phép, vắng không phép. Giữ mọi ngày chốt để so sánh.                                                                                                                          |
| `LmsQuizAttempt`                     | 1 lượt làm bài kiểm tra trên LMS: bài, lần làm, thời điểm, thời lượng, điểm, trạng thái. Bài bị bỏ được suy ra, không lưu.                                                                                                                                                          |
| `CourseResult`                       | Kết quả 1 học phần: điểm quá trình, điểm thi, tổng kết, điểm chữ, đạt/không đạt. `PROCESS_ONLY` (giữa kỳ) hoặc `FINAL`.                                                                                                                                                             |
| `Rule`                               | Định danh 1 luật nghiệp vụ (VD: `ATT-01`), không chứa ngưỡng cụ thể.                                                                                                                                                                                                                |
| `RuleVersion`                        | Phiên bản cụ thể của 1 `Rule`: ngưỡng, trọng số, `severity`, `status` (`DRAFT`/`ACTIVE`/`INACTIVE`/`ARCHIVED`). Sửa ngưỡng luôn tạo phiên bản mới, không ghi đè.                                                                                                                    |
| `RuleTrigger`                        | 1 bằng chứng: 1 lần 1 `RuleVersion` đúng với dữ liệu của 1 sinh viên. Không hiển thị trực tiếp cho người dùng — là input để tạo `Alert`.                                                                                                                                            |
| `EvaluationRun`                      | 1 lần chạy đánh giá (tự động sau nhập hoặc Admin bấm), có tiến độ và tóm tắt.                                                                                                                                                                                                       |
| `RiskScoreLog`                       | Điểm rủi ro tổng hợp có trọng số của 1 sinh viên tại 1 thời điểm, kèm `dataCompletenessLevel`.                                                                                                                                                                                      |
| `Alert`                              | Hồ sơ cảnh báo — cái CVHT thực sự thấy và xử lý. Gộp nhiều `RuleTrigger`. `status`: `OPEN`/`ACKNOWLEDGED`/`IN_PROGRESS`/`RESOLVED`/`DISMISSED`/`INVALIDATED`/`REOPENED`.                                                                                                            |
| `Intervention`                       | 1 hành động can thiệp của CVHT gắn với 1 `Alert`.                                                                                                                                                                                                                                   |
| `Notification`                       | 1 lượt gửi thông báo (`IN_APP`/`EMAIL`) gắn với 1 `Alert`.                                                                                                                                                                                                                           |
| `ImportBatch` / `ImportErrorRow`     | 1 lô nhập dữ liệu và các dòng lỗi của lô đó.                                                                                                                                                                                                                                        |

## Enum dùng chung — không được định nghĩa lệch ở bất kỳ đâu

Có 2 TẦNG enum trạng thái dữ liệu, KHÔNG được gộp làm một:

- **Tầng 1 — `DataStatus`** (trạng thái của TỪNG chỉ số đầu vào riêng lẻ — điểm danh/GPA/LMS — trước khi tính toán): `AVAILABLE` (có dữ liệu, dùng được) / `MISSING` (chưa có dữ liệu) / `NOT_APPLICABLE` (không áp dụng, VD: môn không dùng LMS) / `STALE` (dữ liệu cũ, quá hạn đồng bộ) / `INVALID` (dữ liệu sai định dạng/xung đột). Dùng enum này khi viết logic đọc dữ liệu đầu vào cho 1 chỉ số cụ thể trong `rule-engine`.
- **Tầng 2 — `DataCompletenessLevel`** (mức tổng hợp của TOÀN BỘ RiskScore 1 sinh viên, suy ra TỪ tầng 1): `FULL` (mọi nhóm ÁP DỤNG ĐƯỢC đều `AVAILABLE` — nhóm `NOT_APPLICABLE`, VD môn không dùng LMS, không bị tính là thiếu) / `PARTIAL` (≥1 nhóm `AVAILABLE` nhưng có nhóm áp dụng được không `AVAILABLE`, đã renormalize trọng số trên các nhóm còn `AVAILABLE`) / `INSUFFICIENT` (KHÔNG có nhóm nào `AVAILABLE` — `RiskScoreLog.riskScoreValue = NULL`, KHÔNG được hiển thị như "rủi ro thấp"). Người dùng chốt: thiếu 1 hoặc 2 nhóm → `PARTIAL`; thiếu cả 3 → `INSUFFICIENT`. Dùng enum này khi ghi kết quả vào `RiskScoreLog`.
- **Severity**: `LOW` < `MEDIUM` < `HIGH` < `CRITICAL`. Khi nhiều luật cùng kích hoạt cho 1 sinh viên, severity cuối cùng của `Alert` = giá trị lớn nhất trong số đó (không cộng dồn, không trung bình).
- **AttemptOutcome**: `PENDING` / `PASSED` / `FAILED` — cập nhật từ `CourseResult` `FINAL`, là nguồn tính `attemptNumber` cho `Enrollment` của cùng học phần ở học kỳ sau.
- **ImportBatch.status**: `UPLOADING` → `VALIDATING` → `STAGED` → `LOADED` → `RECONCILED` (thành công) hoặc `REJECTED` (lỗi nghiêm trọng) hoặc `DISCARDED` (bị hủy khi còn `STAGED`, chưa dùng để tính RiskScore) hoặc `ROLLED_BACK` (lô đã nạp được hoàn tác có điều kiện — xem `12`).

## Nguyên tắc tính điểm rủi ro (RiskScore) — cần biết trước khi đụng vào `modules/rule-engine`

`RiskScore = Σ(weight_i × normalizedRisk_i) / Σ(weight_i)`, chỉ tính trên các chỉ số i có `DataStatus = AVAILABLE` (bỏ qua `MISSING`/`INVALID`/`NOT_APPLICABLE`/`STALE` khỏi cả tử số và mẫu số — đây chính là cơ chế renormalize). Chỉ tính bằng dữ liệu đã phát sinh đến thời điểm tính (không dùng dữ liệu tương lai — chống temporal leakage). Nội dung đầy đủ các luật cụ thể và trình tự xử lý: xem `08-business-rules-catalog.md`.

## Căn cứ pháp lý bảo vệ dữ liệu cá nhân

Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026) và Nghị định 356/2025/NĐ-CP (thay thế Nghị định 13/2023/NĐ-CP). Chi tiết nghĩa vụ tuân thủ: xem `04-legal-compliance.md`.
