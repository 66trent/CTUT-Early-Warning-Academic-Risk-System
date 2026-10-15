# 11 — Data Schema Reference: Rule Engine & Alerts

Xem `00-project-context.md` và `08-business-rules-catalog.md` trước. File này đặc tả 10 bảng — phạm vi module `rule-engine` và `alerts`.

## Rule

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| ruleCode | String(20) | NOT NULL | PK | VD: `ATT-01` — MUST giữ nguyên định dạng `NHÓM-số` trong `08` |
| ruleName | String(100) | NOT NULL | | |
| ruleGroup | RuleGroup (enum) | NOT NULL | | `ATTENDANCE`/`ACADEMIC`/`LMS`/`COMBINED`/`EXCEPTION`/`RISK_SCORE` (chỉ `Rule` cấu hình trọng số `RISK-SCORE`, xem `08`) |
| scope | String(30) | NOT NULL | | `PER_COURSE`/`PER_STUDENT` |
| priority | Int | NOT NULL | | Thứ tự ưu tiên khi có xung đột luật |
| cooldown | Int | NOT NULL | | Mặc định 0 = tắt (người dùng chốt: mở lại theo dấu hiệu mới/nặng hơn — `08`). Số GIỜ (đơn vị cố định: giờ) trước khi cho phép tạo `Alert` mới cho cùng khóa tương quan — xem `08-business-rules-catalog.md` |
| status | RuleStatus (enum) | NOT NULL | | `DRAFT`/`ACTIVE`/`INACTIVE`/`ARCHIVED` |

## RuleVersion — MUST tạo bản ghi mới khi sửa, KHÔNG ghi đè

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| ruleCode | String(20) | NOT NULL | FK → Rule | |
| version | Int | NOT NULL | | Tăng dần |
| condition | Json | NOT NULL | | Ngưỡng/toán tử cụ thể — MUST validate bằng Zod trước khi ghi |
| severity | Severity (enum) | NOT NULL | | `LOW`/`MEDIUM`/`HIGH`/`CRITICAL`. Luật nhiều mức (`ATT-01`, `LMS-01`, `ACA-02`, `COMB-02`): các mức nằm trong `condition`, cột này = mức cao nhất luật có thể ra (chỉ hiển thị) |
| action | Json | NOT NULL | | Danh sách hành động khi kích hoạt |
| effectiveFrom | DateTime | NOT NULL | | |
| effectiveTo | DateTime | NULL | | NULL = đang dùng |
| status | RuleStatus (enum) | NOT NULL | | `DRAFT`/`ACTIVE`/`INACTIVE`/`ARCHIVED` |
| configuredBy | String(20) | NOT NULL | FK → User | |
| lastDryRunAt | DateTime | NULL | | Thời điểm chạy thử (dry-run) gần nhất. MUST NOT chuyển `status` sang `ACTIVE` khi còn NULL |

RÀNG BUỘC: UNIQUE `(ruleCode, version)`. Seed 10 luật `ACTIVE` với `lastDryRunAt` = thời điểm seed (ngưỡng mặc định của `08` coi như đã chạy thử). Rule Engine CHỈ đọc `RuleVersion` có `status = ACTIVE`. Chỉ `ADMIN` được tạo/sửa/kích hoạt (mọi thay đổi ghi Audit Log); không có bước duyệt riêng.

## RuleTrigger — bằng chứng, KHÔNG hiển thị trực tiếp cho người dùng

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| alertId | String (uuid) | NULL | FK → Alert | Phase 4 để NULL; Phase 5 gắn trigger vào `Alert` (người dùng chốt) |
| evaluationRunId | String (uuid) | NOT NULL | FK → EvaluationRun | Lần chạy tạo ra trigger — test nghiệm thu so khớp theo lần chạy |
| ruleCode | String(20) | NOT NULL | FK → Rule | |
| ruleVersionId | String (uuid) | NOT NULL | FK → RuleVersion | Bắt buộc để tái lập kết quả |
| studentId | String(20) | NOT NULL | FK → Student | |
| scopeId | String(20) | NOT NULL | | `courseId` nếu `Rule.scope = PER_COURSE`; `studentId` nếu `PER_STUDENT` |
| termId | String(10) | NOT NULL | FK → Term | |
| triggeredAt | DateTime | NOT NULL | | |
| inputSnapshot | Json | NOT NULL | | Giá trị dữ liệu thực tế dẫn đến kích hoạt (phục vụ explainability) |
| reason | String (text) | NOT NULL | | Mô tả dễ hiểu cho CVHT |
| severity | Severity (enum) | NOT NULL | | |

## RiskScoreLog

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| studentId | String(20) | NOT NULL | FK → Student | |
| termId | String(10) | NOT NULL | FK → Term | |
| riskScoreValue | Float | NULL | | NULL nếu `dataCompletenessLevel = INSUFFICIENT` |
| dataCompletenessLevel | DataCompletenessLevel (enum) | NOT NULL | | `FULL`/`PARTIAL`/`INSUFFICIENT` — xem tầng 2 trong `00-project-context.md` |
| componentsUsed | Json | NOT NULL | | `[{ group: ATTENDANCE/LMS/ACADEMIC, status, weight, rawValue, normalized }]` — validate Zod |
| ruleVersionId | String (uuid) | NOT NULL | FK → RuleVersion | Phiên bản `RISK-SCORE` (trọng số) dùng để tính |
| evaluationRunId | String (uuid) | NOT NULL | FK → EvaluationRun | Lần chạy tạo bản ghi — job chạy lại xóa và ghi lại theo lần chạy (idempotent) |
| calculatedAt | DateTime | NOT NULL | | |

## Alert — cái CVHT thực sự thấy và xử lý

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| alertId | String (uuid) | NOT NULL | PK | |
| studentId | String(20) | NOT NULL | FK → Student | |
| termId | String(10) | NOT NULL | FK → Term | |
| severity | Severity (enum) | NOT NULL | | = max() các `RuleTrigger` liên quan |
| status | AlertStatus (enum) | NOT NULL | | `OPEN`/`ACKNOWLEDGED`/`IN_PROGRESS`/`RESOLVED`/`DISMISSED`/`INVALIDATED`/`REOPENED` |
| firstDetectedAt | DateTime | NOT NULL | | |
| lastDetectedAt | DateTime | NOT NULL | | |
| assignedAdvisorId | String(20) | NULL | FK → User | Cố vấn học tập phụ trách lúc tạo/chuyển — dùng cho thông báo và lịch sử; QUYỀN XEM/XỬ LÝ luôn suy ra qua lớp sinh hoạt hiện tại (`06`). NULL khi lớp chưa có Cố vấn học tập — Admin thấy ở mục "Chưa có Cố vấn học tập phụ trách"; gán người cho lớp thì chuyển cảnh báo đang mở |
| lastAsOf | DateTime | NOT NULL | | Mốc `asOf` mới nhất đã áp dụng (lần chạy mốc cũ hơn chỉ thêm bằng chứng — `08`) |
| lastEvaluationRunId | String (uuid) | NOT NULL | | Lần chạy gần nhất ĐÃ ÁP DỤNG — trigger của lần này là "dấu hiệu hiện tại" hiển thị cho Cố vấn học tập |
| closedAt | DateTime | NULL | | Lúc chuyển `RESOLVED`/`DISMISSED`/`INVALIDATED` gần nhất (tính `cooldown` khi bật) |
| riskScoreLogId | String (uuid) | NULL | FK → RiskScoreLog | NULL nếu `Alert` chỉ phát sinh từ luật cứng |
| closedReason | String (text) | NULL | | Lý do khi chuyển `DISMISSED`/`INVALIDATED` — MUST NOT NULL ở hai trạng thái này |
| isReferenceOnly | Boolean | NOT NULL, default `true` | | CHECK `is_reference_only = true` ở DB. MUST luôn `true` — xem ràng buộc phạm vi hệ thống |

RÀNG BUỘC chuyển trạng thái (MUST validate ở service, không chỉ ở DB):
- Chuyển sang `DISMISSED` MUST có `Alert.closedReason`.
- Chuyển sang `RESOLVED` MUST có ít nhất 1 `Intervention` liên kết (người dùng nâng từ SHOULD).
- Bảng chuyển hợp lệ — Cố vấn học tập phụ trách: `OPEN`/`REOPENED` → `ACKNOWLEDGED` → `IN_PROGRESS` → `RESOLVED`; từ `OPEN`/`REOPENED`/`ACKNOWLEDGED`/`IN_PROGRESS` → `DISMISSED` hoặc `INVALIDATED` (bắt buộc lý do). Ghi `Intervention` khi đang `OPEN`/`REOPENED`/`ACKNOWLEDGED` → tự chuyển `IN_PROGRESS`. Chỉ HỆ THỐNG chuyển `RESOLVED`/`DISMISSED` → `REOPENED` và `INVALIDATED` sau hoàn tác lô (`08`). `INVALIDATED` là trạng thái cuối. Admin KHÔNG có chuyển nào.
- Mỗi chuyển: 1 dòng `AlertStateHistory` + Audit Log `ALERT_STATUS_CHANGED`, cùng transaction.
- `INVALIDATED` dùng khi dữ liệu nguồn bị sửa khiến cảnh báo không còn đúng — MUST NOT tự xóa `Alert`.

## Intervention

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| interventionId | String (uuid) | NOT NULL | PK | |
| alertId | String (uuid) | NOT NULL | FK → Alert | |
| performedBy | String(20) | NOT NULL | FK → User | |
| type | InterventionType (enum) | NOT NULL | | `EMAIL`/`PHONE_CALL`/`IN_PERSON_MEETING`/`OTHER` |
| content | String (text) | NOT NULL | | |
| performedAt | DateTime | NOT NULL | | |
| outcome | String (text) | NULL | | |
| nextFollowUpAt | DateTime | NULL | | |
| status | String(20) | NOT NULL | | `DONE` (đã thực hiện) / `FOLLOW_UP` (cần theo dõi tiếp — có `nextFollowUpAt`) — union + Zod |
| confidentialityLevel | ConfidentialityLevel (enum) | NOT NULL | | `NORMAL`/`SENSITIVE` — xem `04-legal-compliance.md` khi `SENSITIVE` |

## Notification

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| notificationId | String (uuid) | NOT NULL | PK | |
| alertId | String (uuid) | NOT NULL | FK → Alert | |
| recipientId | String(20) | NOT NULL | FK → User | |
| channel | NotificationChannel (enum) | NOT NULL | | `EMAIL`/`IN_APP` |
| status | NotificationStatus (enum) | NOT NULL | | `QUEUED`/`SENT`/`FAILED` |
| sentAt | DateTime | NULL | | |
| readAt | DateTime | NULL | | Chỉ `IN_APP`: lúc người nhận đã xem — cho số chưa đọc trên chuông thông báo |
| event | String(30) | NOT NULL | | `CREATED`/`REOPENED`/`SEVERITY_INCREASED` (union + Zod) |
| evaluationRunId | String (uuid) | NOT NULL | | Lần chạy làm phát sinh sự kiện. UNIQUE `(alertId, channel, event, evaluationRunId)` chặn trùng khi job chạy lại |
| createdAt | DateTime | NOT NULL | | |

RÀNG BUỘC: không có cơ chế chống gửi trùng / giới hạn tần suất (người dùng quyết định bỏ). `Notification` chỉ được tạo khi có sự kiện ở `06-security.md` (mục "Thông báo và email sinh viên"); index `(alertId, createdAt)`.

## AlertStateHistory — append-only

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| alertId | String (uuid) | NOT NULL | FK → Alert | |
| fromStatus | AlertStatus (enum) | NULL | | NULL khi tạo mới |
| toStatus | AlertStatus (enum) | NOT NULL | | |
| changedBy | String(20) | NULL | FK → User | NULL khi do hệ thống (VD: `INVALIDATED`) |
| reason | String (text) | NULL | | |
| changedAt | DateTime | NOT NULL | | |

## AuditLog — append-only

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | |
| actorId | String(20) | NULL | FK → User | NULL với sự kiện đăng nhập thất bại chưa xác định người dùng |
| action | String(60) | NOT NULL | | VD: `RULE_ACTIVATED`, `ALERT_STATUS_CHANGED`, `IMPORT_CREATED`, `LOGIN_FAILED`, `ROLE_CHANGED` |
| targetType | String(40) | NOT NULL | | |
| targetId | String(40) | NULL | | |
| detail | Json | NULL | | Không chứa dữ liệu nhạy cảm của `Intervention SENSITIVE` |
| createdAt | DateTime | NOT NULL | | |

RÀNG BUỘC: không expose `UPDATE`/`DELETE` ở tầng ứng dụng (xem `06-security.md`).

## EvaluationRun — 1 lần chạy đánh giá luật

| Field | Kiểu | Null? | Khóa | Ghi chú |
|---|---|---|---|---|
| id | String (uuid) | NOT NULL | PK | Dùng làm `jobId` gốc của BullMQ |
| termId | String(10) | NOT NULL | FK → Term | |
| courseId | String(20) | NULL | FK → Course | NULL = toàn bộ học kỳ |
| trigger | EvaluationTrigger (enum) | NOT NULL | | `AUTO_AFTER_IMPORT`/`MANUAL` |
| asOf | DateTime | NOT NULL | | Mốc dữ liệu được dùng khi tính — xem `08` (mặc định = `createdAt`) |
| triggeredBy | String(20) | NULL | FK → User | NULL khi `AUTO_AFTER_IMPORT` |
| importBatchId | String (uuid) | NULL | FK → ImportBatch | Có khi `AUTO_AFTER_IMPORT` |
| dataWarnings | Json | NULL | | Cảnh báo chất lượng dữ liệu phát hiện khi chạy (VD: số vắng giảm giữa 2 lần nhập — xem `ATT-02`) |
| status | EvaluationRunStatus (enum) | NOT NULL | | `QUEUED`/`RUNNING`/`COMPLETED`/`FAILED` |
| totalStudents | Int | NOT NULL | | |
| processedStudents | Int | NOT NULL | | Cập nhật định kỳ để hiển thị tiến độ |
| alertsCreated | Int | NOT NULL | | |
| alertsUpdated | Int | NOT NULL | | |
| insufficientCount | Int | NOT NULL | | Số sinh viên `DataCompletenessLevel = INSUFFICIENT` |
| errorMessage | String (text) | NULL | | Khi `FAILED` |
| startedAt | DateTime | NULL | | |
| finishedAt | DateTime | NULL | | |
| createdAt | DateTime | NOT NULL | | |

RÀNG BUỘC: không cho 2 `EvaluationRun` `QUEUED`/`RUNNING` cùng `(termId, courseId)` — MUST từ chối lần bấm thứ hai (`MANUAL`) và báo "đang chạy". `AUTO_AFTER_IMPORT` khi đã có lần `QUEUED` cùng phạm vi → gộp vào lần đó; khi chỉ có lần `RUNNING` → tạo lần `QUEUED` mới, chạy sau (khóa advisory theo phạm vi). Partial unique index `(termId, COALESCE(courseId, ''))` `WHERE status = 'QUEUED'` (viết tay trong migration).

## Quan hệ tóm tắt

`Rule 1—n RuleVersion` · `RuleVersion 1—n RuleTrigger, RiskScoreLog` · `Alert 1—n RuleTrigger, Intervention, Notification` · `Alert n—1 User` (qua `assignedAdvisorId`) · `Alert n—0..1 RiskScoreLog` · `Alert 1—n AlertStateHistory` · `EvaluationRun n—1 Term`.
