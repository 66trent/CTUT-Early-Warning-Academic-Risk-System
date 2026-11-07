# Tích hợp Moodle — nghiên cứu khả thi và đề xuất (2026-11-07)

> Yêu cầu của giảng viên: lấy dữ liệu **điểm danh, bài trắc nghiệm, bài thực hành** từ Moodle (mã nguồn mở, trường đang dùng) và kết nối gần thời gian thực với CTUT-EWARS.
> Trạng thái: **ĐÃ CHỐT HƯỚNG (mục 9), CHƯA CODE** — kế hoạch Phase 10 ở `docs/implement.md`. Đây là **mở rộng phạm vi** (trước đây `implement.md` ghi "Ngoài phạm vi: API đồng bộ SIS/LMS").
> Căn cứ: đọc trực tiếp mã nguồn `moodle/moodle` (nhánh `main` = 6.0dev, bản ổn định mới nhất `MOODLE_503_STABLE` = Moodle 5.3 LTS, phát hành 05/10/2026) và plugin điểm danh `danmarsden/moodle-mod_attendance` (nhánh `MOODLE_503_STABLE`, bản 2026090300, "Requires 5.3").

## 0. Trả lời ngắn

**Được.** Moodle có sẵn **Web service REST** đọc được đủ 3 nguồn; điểm danh cần plugin **Attendance** (`mod_attendance`, plugin phổ biến nhất, có web service riêng). Hệ thống hiện tại gần như không phải sửa phần lõi:

- Rule engine (12 luật), cảnh báo, giao diện CVHT/sinh viên **giữ nguyên** — chúng chỉ đọc bảng nguồn (`AttendanceSummary`, `LmsActivity`, `LmsQuizAttempt`, `LmsAssignmentSubmission`).
- Phần thêm mới nằm trong module `data-import`: một **bộ đồng bộ Moodle** gọi API → **tự sinh file CSV đúng mẫu hiện tại** (mỗi lớp học phần 1 file) → đi qua **đúng đường nạp nhiều file đã có** (kiểm tra dòng, tạo `Course`/`Enrollment`, lịch sử nạp, bảng độ mới, chạy đánh giá sau nạp).
- "Thời gian thực" làm 2 tầng: (1) **kéo định kỳ** 5–10 phút (chỉ cần token, không cài gì lên Moodle); (2) **plugin nhỏ trên Moodle đẩy sự kiện** (sinh viên nộp bài, giảng viên điểm danh) → EWARS cập nhật trong ~1 phút.
- Kết quả học phần (bảng điểm đã khóa) **vẫn nạp file** từ hệ thống đào tạo — sổ điểm Moodle không phải điểm chính thức.

Lưu ý: `moodle.org` là trang cộng đồng, **không có dữ liệu của trường** để lấy. "Dùng moodle.org" = dùng **mã nguồn Moodle** để tự dựng 1 Moodle 5.3 (Docker) giống của trường, tạo khóa học/sinh viên/bài demo, rồi cho EWARS kết nối vào.

## 1. Moodle cho lấy dữ liệu bằng những cách nào

| Cách | Mô tả | Thời gian thực | Cần gì ở Moodle trường | Đánh giá |
|---|---|---|---|---|
| **A. Web service REST** (core) | `POST /webservice/rest/server.php` với `wsfunction=...`, token của 1 tài khoản dịch vụ | Kéo định kỳ (5–10 phút) | Bật web service, tạo "External service" chỉ gồm hàm ĐỌC, cấp token | **Chọn làm nền** — chính thức, ổn định qua nhiều phiên bản, không cài code lên Moodle |
| **B. Plugin tự viết `local_ewars`** (Events API) | Bắt sự kiện Moodle (`attempt_submitted`, `assessable_submitted`, `attendance_taken`…) → gửi HTTP POST "có sự kiện ở khóa X" sang EWARS | ~1 phút (Moodle cron chạy mỗi phút) | Cài plugin PHP (~150 dòng) — cần IT trường đồng ý | **Chọn làm tầng thời gian thực** — gửi chỉ mã số (không dữ liệu cá nhân), EWARS tự gọi lại cách A để lấy chi tiết |
| C. Plugin `local_webhooks` (bên thứ ba) | Gửi mọi sự kiện đã chọn tới 1 URL | Gần tức thời | Cài plugin | Không chọn: không lọc theo khóa học, kho mã đã lưu trữ (`archive/master-2026-08-12`), chưa rõ hỗ trợ 5.3 |
| D. xAPI (`logstore_xapi`) → LRS | Gửi câu lệnh xAPI tới kho LRS | Gần tức thời | Cài plugin + dựng LRS | Không chọn: phải dựng thêm LRS, dữ liệu xAPI không có trạng thái điểm danh/hạn nộp gọn |
| E. Đọc thẳng CSDL Moodle | Truy vấn bảng `mdl_*` | Tức thời | Mở cổng DB | **Không làm**: vi phạm bảo mật, vỡ khi Moodle nâng cấp |
| F. REST API mới của 5.3 (OAuth 2, personal access token) | API kiểu mới, có Swagger | — | Moodle ≥ 5.3 | Chưa đủ hàm cho quiz/assign/attendance — theo dõi, chưa dùng |
| G. LTI Advantage | Nhúng công cụ ngoài vào khóa học | — | — | Không phù hợp: dùng để nhúng ứng dụng, không để kéo dữ liệu toàn lớp |

## 2. Các hàm web service cần dùng (chỉ ĐỌC)

| Mục đích | Hàm | Ghi chú (đã kiểm trong mã nguồn) |
|---|---|---|
| Kiểm tra kết nối, phiên bản, danh sách hàm được cấp | `core_webservice_get_site_info` | Hiện ở màn "Kết nối Moodle" |
| Tìm khóa học theo mã lớp học phần | `core_course_get_courses_by_field` (`field=idnumber`) | Khóa học Moodle = 1 lớp học phần; mã lớp học phần ghi ở **Course ID number** |
| Tìm bài điểm danh/trắc nghiệm/thực hành trong khóa | `core_course_get_contents` | Lấy `modname` + `instance` |
| Danh sách sinh viên của khóa | `core_enrol_get_enrolled_users` | Lấy `idnumber` (= MSSV), `email`; KHÔNG lưu họ tên |
| Bài trắc nghiệm | `mod_quiz_get_quizzes_by_courses` | `timeopen`, `timeclose`, **`duedate` (mới ở 5.3)**, `grade`, `sumgrades` |
| Phát hiện thay đổi điểm (1 lần gọi/khóa) | `gradereport_user_get_grade_items` (`userid=0`) | `gradedatesubmitted`, `graderaw` của mọi sinh viên |
| Lượt làm bài | `mod_quiz_get_user_quiz_attempts` (`status=all`) | 1 lần gọi / (bài, sinh viên) → chỉ gọi cho sinh viên có thay đổi; `get_user_attempts` cũ đã deprecated. Cần quyền `mod/quiz:viewreports` |
| Bài thực hành | `mod_assign_get_assignments` (`includenotenrolledcourses=1`) | `duedate`, `cutoffdate`. Tài khoản dịch vụ không ghi danh vào khóa học → **bắt buộc** `includenotenrolledcourses`, nếu không Moodle trả rỗng + cảnh báo "User is not enrolled" (phát hiện ở Phase 10a) |
| Trạng thái nộp | `mod_assign_get_submissions` (`since=<lần trước>`) | `status` (`new`/`draft`/`submitted`/`reopened`), `timemodified`; có tham số `since` → đồng bộ tăng dần |
| Gia hạn riêng | `mod_assign_get_user_flags` | `extensionduedate` |
| Điểm danh | `mod_attendance_get_sessions` (`attendanceid`) | Mỗi buổi: `sessdate`, `duration` (giây), `groupid`, `statuses` (ký hiệu P/L/E/A), `attendance_log` (sinh viên → trạng thái) — **1 lần gọi lấy cả học kỳ**. Cần quyền `mod/attendance:takeattendances` (plugin không có quyền chỉ đọc cho hàm này) — token vẫn chỉ gọi được hàm đọc |

Ước lượng tải: mỗi lớp học phần mỗi chu kỳ ≈ 8–10 lần gọi + số sinh viên có bài mới. 1 khoa ~60 lớp học phần × 10 phút → vài nghìn lần gọi/giờ, nhẹ với Moodle. Mỗi đêm chạy **đồng bộ đầy đủ** (gọi lại mọi lượt làm bài) để vá sự kiện bị lỡ.

Kiểm chứng ở Phase 10a trên Moodle 5.3 Docker (`npm run moodle:fixtures` → `tests/fixtures/moodle/`): đủ 11 hàm trả dữ liệu mọi sinh viên; `core_enrol_get_enrolled_users` trả `idnumber` + `email` nhờ `showuseridentity`; giảng viên không có ID number nên Moodle bỏ trường đó (chỉ xét người có vai `student`); `gradereport_user_get_grade_items.gradedatesubmitted` của bài thực hành là lúc ghi vào sổ điểm, KHÔNG phải lúc nộp → lấy thời điểm nộp từ `mod_assign_get_submissions.timemodified`.

## 3. Đối chiếu dữ liệu Moodle → mẫu file hiện tại

Bộ đồng bộ sinh đúng các cột của `public/templates/*.csv`, nên kiểm tra dữ liệu (`parseRow`, `checkReferences`) và ghi (`load`) dùng lại 100%.

**Chung:** `mssv` ← `user.idnumber` (trống → khớp email đã lưu của sinh viên, không suy MSSV từ email — đã chốt ở `doi-soat`); `ma_lop_hoc_phan` ← `course.idnumber`; `ma_hoc_phan` suy như hiện nay (bỏ 2 số cuối) hoặc điền ở màn liên kết; thời gian Moodle là Unix timestamp (UTC) → không còn lỗi đọc ngày kiểu "Thursday, 15 October…".

**Trắc nghiệm** (`LMS_QUIZ`): `ma_bai` ← `quiz.id` (ổn định, không đổi khi giảng viên đổi tên) · `ten_bai` ← `quiz.name` · `han_nop` ← `duedate` (5.3), không có thì `timeclose`, không có nữa thì để trống (luật dùng cách cũ ≥ 50% lớp + 3 ngày) · `lan_lam` ← `attempt.attempt` · `thoi_diem_bat_dau/nop` ← `timestart/timefinish` · `diem` ← `sumgrades` quy về thang `quiz.grade` · `diem_toi_da` ← `quiz.grade` · `trang_thai` ← `state` (`finished` → Đã nộp, `inprogress`/`overdue` → Đang làm, `abandoned` → Bỏ dở). Sinh viên của khóa không có lượt nào → dòng "Chưa làm" (biết chắc ai bỏ bài — bỏ được giới hạn "chỉ bắt bài đa số lớp đã làm" của `LMS-01`). `so_cau_dung/tong_so_cau` (chỉ hiển thị) bỏ trống — lấy phải gọi xem lại từng lượt, quá nặng.

**Thực hành** (`LMS_ASSIGNMENT`): `ma_bai` ← `assign.id` · `han_nop` ← `duedate` · `trang_thai_nop`: `submitted` và `timemodified ≤ hạn` → Đã nộp; `> hạn` → Nộp trễ; `new`/`draft`/không có bài → Chưa nộp (Moodle cũng coi bản nháp là "chưa nộp") · `thoi_diem_nop` ← `timemodified`. Sinh viên được **gia hạn riêng** chưa nộp và chưa hết hạn gia hạn → không sinh dòng (tránh `LMS-03` báo oan, vì `LmsActivity.dueAt` chỉ có 1 hạn chung).

**Điểm danh** (`ATTENDANCE_SUMMARY`) — chỗ duy nhất phải quy đổi:
- Moodle ghi theo **buổi** (có thời lượng), trường tính theo **tiết** → số tiết của buổi = `duration ÷ số phút 1 tiết` (cấu hình được, **cần trường xác nhận**).
- Trạng thái → loại vắng theo **ký hiệu** (cấu hình được): mặc định `E` (Excused) → vắng có phép, `A` (Absent) → vắng không phép, `P`/`L` → có mặt (đi trễ không xét — đã bỏ ATT-03).
- `tong_so_tiet` = tổng tiết mọi buổi đã tạo của khóa (giảng viên thường tạo cả lịch học kỳ một lần) — Admin **ghi đè được** ở màn liên kết nếu lịch chưa đủ. Buổi theo nhóm chỉ tính cho sinh viên trong nhóm.
- Buổi đã qua mà chưa điểm danh → không tính. `ngay_chot` = ngày đồng bộ (nạp lại cùng ngày = cập nhật, đúng ràng buộc UNIQUE hiện có).
- Lần kết nối đầu: Moodle có ngày của từng buổi nên **dựng lại được các ngày chốt hằng tuần** từ đầu học kỳ → `ATT-02` (tăng vắng trong 14 ngày) chạy được ngay.

## 4. Kiến trúc đề xuất

```
Moodle 5.3 (+ mod_attendance, + local_ewars)
   │  ① sự kiện (chỉ mã số, ký HMAC) ──► POST /api/integrations/moodle/events ─┐
   │                                                                            ▼
   │  ② web service REST (token chỉ đọc) ◄── worker: queue `moodle-sync` ◄─ job theo khóa (gom 30 giây)
   │                                           │        ▲ lịch 10 phút + đồng bộ đầy đủ mỗi đêm
   │                                           ▼
   │                             sinh CSV đúng mẫu (1 file / lớp học phần) → MinIO
   │                                           ▼
   └──────────────────────────► ImportBatch source=MOODLE, tự xác nhận (lô nhiều file sẵn có)
                                               ▼
                         RECONCILED → EvaluationRun AUTO_AFTER_IMPORT (gom) → Alert → CVHT
```

- **Tự sinh CSV rồi nạp theo đường cũ**: giữ được file gốc (MinIO) để tra lại, lịch sử nạp, thẻ học phần, kiểm tra trùng khóa. Dữ liệu không đổi → checksum trùng → bỏ qua lặng lẽ (không tạo lô rác mỗi 10 phút).
- **Sự kiện chỉ là "chuông báo"**: payload gồm tên sự kiện, `courseid`, `objectid`, thời điểm — không có điểm, không có tên. EWARS không tin payload, luôn gọi lại web service lấy dữ liệu → giả mạo sự kiện cũng không ghi được dữ liệu sai.
- Plugin dùng **adhoc task** (không gửi ngay trong lúc sinh viên bấm nộp → không làm chậm Moodle); EWARS chết thì nhiệm vụ tự thử lại; đồng bộ đêm vá phần còn sót.
- **Chỉ đọc**: external service chỉ chứa hàm loại `read` → EWARS không bao giờ ghi vào Moodle.

### 4a. Hai chế độ: Tự động và Chạy tay (người dùng chốt 2026-11-07)

| | **Tự động** | **Chạy tay** |
|---|---|---|
| Khi nào lấy dữ liệu | Ngay khi Moodle có sự kiện (bảng 4b) + lịch 10 phút + đầy đủ mỗi đêm + đúng giờ hết hạn nộp | Admin bấm **Đồng bộ ngay** (1 khóa hoặc cả học kỳ) |
| Nạp | Tự xác nhận | Lô `STAGED` → màn xem trước như nạp file → Admin **Xác nhận nạp** / **Hủy** |
| Chạy đánh giá | Tự chạy ngay sau nạp (gom các sự kiện trong ~1 phút thành 1 lần chạy) | Như hiện nay: chạy sau xác nhận, hoặc Admin bấm **Chạy đánh giá** |
| Dùng khi | Vận hành hằng ngày, trình diễn "thời gian thực" | Lần kết nối đầu, kiểm tra trước khi bật tự động, khi nghi dữ liệu Moodle sai |

Chọn chế độ ở trang **Kết nối Moodle**, theo từng khóa học liên kết (mặc định Chạy tay khi mới liên kết → Admin xem trước lần đầu rồi bật Tự động). Ở chế độ Tự động, Admin vẫn bấm Đồng bộ ngay được. Chế độ Tự động vẫn chạy khi `DEMO_MODE=true` (học kỳ Moodle demo theo ngày thật, mốc đánh giá = bây giờ) — khác với nạp file demo (không tự chạy).

### 4b. Sự kiện Moodle → việc EWARS làm

| Trên Moodle vừa xảy ra | Sự kiện (plugin bắt) | EWARS làm |
|---|---|---|
| Giảng viên điểm danh / sửa điểm danh | `\mod_attendance\event\attendance_taken`, `attendance_taken_by_student`, `session_added/updated/deleted`, `session_duration_updated` | Kéo điểm danh khóa đó → cập nhật ngày chốt hôm nay → đánh giá |
| Giảng viên tạo / sửa / xóa bài trắc nghiệm hoặc thực hành (kể cả đổi hạn nộp) | `\core\event\course_module_created/updated/deleted` | Kéo danh sách bài + hạn nộp → **hẹn giờ** đánh giá lại đúng lúc hết hạn (4c) |
| Sinh viên nộp / bỏ dở bài trắc nghiệm, giảng viên chấm lại | `\mod_quiz\event\attempt_submitted`, `attempt_abandoned`, `attempt_regraded`, `attempt_deleted`, `user_override_*` | Kéo lượt làm của sinh viên đó → đánh giá |
| Sinh viên nộp / gỡ bài thực hành, giảng viên gia hạn | `\mod_assign\event\assessable_submitted`, `submission_status_updated`, `submission_removed`, `extension_granted`, `user_override_*` | Kéo trạng thái nộp → đánh giá |
| Thêm / rút sinh viên khỏi khóa | `\core\event\user_enrolment_created/deleted` | Kéo danh sách sinh viên của khóa |

### 4c. Cảnh báo "không nộp bài" đến từ thời gian trôi, không từ sự kiện

`LMS-01` (bỏ bài trắc nghiệm) và `LMS-03` (không nộp bài thực hành) đúng khi **hạn nộp đã qua** mà sinh viên chưa nộp — lúc đó Moodle **không phát sự kiện nào**. Vì vậy mỗi khi biết hạn nộp của 1 bài, EWARS đặt 1 job hẹn giờ (BullMQ delayed job, `jobId` = bài + hạn nộp; đổi hạn → hủy job cũ, đặt job mới) chạy **hạn nộp + 5 phút**: kéo trạng thái bài đó → đánh giá khóa đó. Lịch đêm là lưới an toàn nếu job hẹn giờ bị lỡ.

## 5. Thay đổi dự kiến trong hệ thống

| Phần | Thay đổi |
|---|---|
| Dữ liệu | `ImportSource` thêm `MOODLE` (migration `ALTER TYPE`). Bảng mới `MoodleCourseLink` (khóa Moodle ↔ học kỳ + mã lớp học phần, bật/tắt, ghi đè tổng tiết, lần đồng bộ gần nhất, lỗi gần nhất). Bảng `MoodleEventInbox` (chống nhận trùng sự kiện, idempotent). Tài khoản hệ thống "Đồng bộ Moodle" làm `performedBy` |
| `data-import` | `moodle/client.ts` (gọi REST, POST, timeout, retry), `moodle/mappers/*.ts` (thuần, test bằng JSON mẫu), `moodle/sync.service.ts` (sinh CSV → lô), `moodle/webhook.ts` (kiểm HMAC) |
| Worker | Queue thứ 4 `moodle-sync` (lặp 10 phút + đêm), jobId theo (khóa, khung 30 giây) để gom |
| Route Handler | `POST /api/integrations/moodle/events` — mở rộng danh sách Route Handler được phép ở `01` |
| Giao diện Admin | Trang **Kết nối Moodle** (trạng thái, phiên bản, hàm được cấp; danh sách khóa học của học kỳ → bật đồng bộ; "Đồng bộ ngay"; lỗi gần nhất). Lịch sử nạp + bảng độ mới hiện nhãn nguồn **Moodle** |
| Môi trường | `MOODLE_BASE_URL`, `MOODLE_WS_TOKEN`, `MOODLE_WEBHOOK_SECRET`, `MOODLE_SYNC_INTERVAL_MINUTES` (tùy chọn — trống = tắt tính năng, như Google OAuth) |
| Plugin Moodle | `integrations/moodle/local_ewars/` (PHP): `db/events.php`, `classes/observer.php`, `classes/task/send_event.php`, trang cài đặt URL + khóa bí mật |
| Rules cập nhật | `00` (nguồn dữ liệu), `01` (route, queue, module), `04` (luồng dữ liệu cá nhân Moodle → EWARS), `05` (tải đồng bộ), `06` (token, HMAC, Audit Log), `07` (màn Kết nối Moodle), `10`, `12` (lô nguồn Moodle tự xác nhận, không hoàn tác) |
| Không đổi | Rule engine, 12 luật, `Alert`, giao diện CVHT/sinh viên, nạp file (vẫn dùng song song) |

Lô nguồn Moodle **không hoàn tác** (Moodle là nguồn sự thật, lần đồng bộ sau sẽ ghi lại); sai dữ liệu thì sửa trên Moodle.

## 6. Bảo mật và dữ liệu cá nhân

- Token web service để trong biến môi trường (không lưu DB, không ghi log), gửi trong **thân POST** (không đặt trên URL — tránh lọt vào nhật ký máy chủ). Tài khoản dịch vụ Moodle chỉ có quyền đọc cần thiết (`moodle/course:viewparticipants`, `mod/quiz:viewreports`, `mod/assign:grade` hoặc quyền xem bài nộp, quyền xem điểm danh). Bắt buộc HTTPS khi chạy thật.
- Sự kiện: chữ ký HMAC-SHA256 + dấu thời gian (lệch > 5 phút → từ chối, chống gửi lại) + giới hạn tần suất; Audit Log mỗi lần đồng bộ (số dòng, lỗi) và đổi cấu hình liên kết.
- Tối thiểu hóa: chỉ lấy MSSV, email, thời gian, điểm, trạng thái — **không lấy họ tên, ảnh, nội dung bài làm**. Trang chính sách dữ liệu cá nhân thêm "nguồn: hệ thống Moodle của trường" (Luật 91/2025/QH15).
- Khi dùng Moodle thật của trường: cần **văn bản đồng ý của phòng CNTT/Phòng Đào tạo** cấp token và cho cài plugin — ngoài phạm vi code.

## 7. Môi trường demo

- Thêm Moodle 5.3 + `mod_attendance` + `local_ewars` vào `docker-compose.yml` (profile riêng `moodle`, cổng chỉ `127.0.0.1`, thêm ~1–2 GB RAM).
- Script dựng dữ liệu Moodle demo: tạo khóa học (ID number = mã lớp học phần), tài khoản sinh viên (ID number = MSSV demo), ghi danh, bài trắc nghiệm, bài thực hành, buổi điểm danh — chủ yếu bằng web service (`core_user_create_users`, `enrol_manual_enrol_users`, `mod_attendance_add_session`, `mod_attendance_update_user_status`…), phần tạo bài bằng script CLI PHP của Moodle.
- **Tự làm tay** (mục 9.6): tài liệu `docs/huong-dan-moodle.md` hướng dẫn từng bước trên Moodle — tạo khóa học (Course ID number = mã lớp học phần), tạo tài khoản sinh viên (ID number = MSSV có trong EWARS), ghi danh, thêm hoạt động Attendance + buổi học + điểm danh, thêm Quiz (có hạn nộp) và Assignment (có hạn nộp), đăng nhập sinh viên làm bài/nộp bài; rồi bên EWARS: liên kết khóa học → Đồng bộ ngay / bật Tự động.
- **Xung đột ngày**: bộ demo v3 nằm ở `HK1_2025` (18/08–28/12/2025, mốc trong quá khứ); dữ liệu Moodle tạo hôm nay mang ngày 2026 → `TERM_MISMATCH`. → Demo Moodle cần **học kỳ demo riêng theo ngày thật** (VD HK1 2026–2027) và lớp học phần riêng, không đụng kịch bản v3 đã kiểm thử.
- Màn trình diễn: sinh viên làm bài/nộp bài trên Moodle, giảng viên điểm danh vắng → ~1 phút sau CVHT thấy cảnh báo mới + chuông + email MailHog.
- Test tự động KHÔNG phụ thuộc Moodle thật: máy chủ giả trả JSON mẫu ghi lại từ Moodle 5.3 Docker (test hợp đồng cho từng mapper + test tích hợp đồng bộ → so khớp bảng nguồn).

## 8. Giới hạn đã biết

1. 1 khóa Moodle gộp nhiều lớp học phần (meta course / nhóm) → bản đầu chưa tách; mỗi khóa = 1 lớp học phần.
2. Gia hạn/ngoại lệ riêng của bài trắc nghiệm (`mod_quiz_get_overrides` cần quyền quản lý) chưa xét — chỉ xét gia hạn bài thực hành.
3. "Vắng một phần buổi" (trường nhập số tiết) không có trong Moodle — chỉ tính cả buổi theo trạng thái.
4. Moodle cũ hơn 5.3 không có `duedate` của trắc nghiệm → dùng `timeclose`; hỗ trợ tối thiểu 4.5 LTS (bản cũ dùng `mod_quiz_get_user_attempts`).
5. Kết quả học phần vẫn nạp file (điểm chính thức không nằm trong Moodle).
6. "Thời gian thực" = ~1 phút (cron Moodle) với plugin, 5–10 phút nếu chỉ kéo định kỳ.

## 9. Đã chốt với người dùng (2026-11-07)

1. Cách kết nối: **kéo định kỳ + plugin `local_ewars` đẩy sự kiện** (làm kéo trước, plugin sau).
2. Moodle để làm và demo: **tự dựng Moodle 5.3 Docker** + học kỳ demo riêng theo ngày thật; không đụng bộ demo v3 / kịch bản 9c.
3. Dữ liệu vào: **cả 2 chế độ Tự động và Chạy tay** (mục 4a). Tự động = có dữ liệu mới trên Moodle (điểm danh, bài mới, bài nộp) → kéo về → đánh giá ngay; thêm job hẹn giờ lúc hết hạn nộp (mục 4c).
4. Điểm danh: **lấy từ Moodle Attendance, quy đổi phút → tiết**: **1 tiết = 50 phút** (người dùng xác nhận 2026-11-07), ký hiệu mặc định `E` có phép, `A` không phép, `P`/`L` có mặt — cả hai cấu hình được; nạp file điểm danh vẫn dùng song song.
5. Học kỳ demo Moodle **theo ngày thật** (giá trị demo, đề xuất `HK1_2026` 17/08–27/12/2026, `isCurrent`), tách khỏi bộ v3 (`HK1_2025`).
6. Dữ liệu Moodle demo có **2 cách**: (a) script tự dựng; (b) **người dùng tự làm tay** trên giao diện Moodle (tạo khóa học = lớp học phần, ghi danh, buổi điểm danh, bài trắc nghiệm, bài thực hành) theo hướng dẫn từng bước — EWARS nhận như nhau.
7. Mã học phần / mã lớp học phần: **tự thiết kế, không xác minh với trường** (giảng viên hướng dẫn: do Phòng Đào tạo quản lý). Quy ước: **Course ID number** của khóa Moodle = mã lớp học phần 12 số như mẫu hiện có (VD `010100240802`); mã học phần = bỏ 2 số cuối (như hiện nay); Admin sửa được ở màn liên kết. Ghi vào "Giới hạn đã biết" của báo cáo.

## 10. Kế hoạch dự kiến (sau khi chốt)

| Phase | Nội dung | DoD chính |
|---|---|---|
| 10a | Moodle 5.3 Docker + `mod_attendance` + script dựng dữ liệu demo; ghi lại JSON mẫu | Đăng nhập Moodle local thấy khóa học, sinh viên, bài, buổi điểm danh |
| 10b | Bộ đồng bộ kéo + **chế độ Chạy tay**: client, 3 mapper, sinh CSV → lô `MOODLE` (`STAGED` → xem trước → xác nhận), queue `moodle-sync`, trang Kết nối Moodle, rules | Test mapper + tích hợp xanh; bấm "Đồng bộ ngay" → xem trước → xác nhận → bảng độ mới hiện dữ liệu Moodle; cảnh báo đúng như nạp file |
| 10c | **Chế độ Tự động**: plugin `local_ewars` + endpoint sự kiện + gom job + tự xác nhận + tự đánh giá + job hẹn giờ hết hạn + lịch 10 phút/đêm | Giảng viên điểm danh / sinh viên nộp bài trên Moodle → ≤ 2 phút CVHT thấy cảnh báo; bài quá hạn chưa nộp → cảnh báo ≤ 10 phút sau hạn |
| 10d | Kịch bản trình diễn Moodle, báo cáo (sơ đồ tích hợp), ảnh chụp | Diễn tập trọn kịch bản |

## Nguồn tham khảo

- Mã nguồn Moodle: <https://github.com/moodle/moodle> — `public/mod/quiz/db/services.php`, `public/mod/quiz/classes/external.php`, `public/mod/assign/db/services.php`, `public/mod/assign/externallib.php`, `public/grade/report/user/classes/external/user.php`, sự kiện `public/mod/{quiz,assign}/classes/event/`.
- Plugin điểm danh: <https://github.com/danmarsden/moodle-mod_attendance> — `db/services.php`, `classes/external/get_sessions.php`, `classes/event/`.
- Ghi chú phát hành Moodle 5.3: <https://moodledev.io/general/releases/5.3> (hạn nộp cho trắc nghiệm, OAuth 2 cho REST API mới).
- Plugin WebHooks bên thứ ba (đã xem, không chọn): <https://moodle.org/plugins/local_webhooks>, <https://github.com/OpenCollabZA/moodle-local_webhooks>.
- Web service Moodle: <https://moodledev.io/docs/apis/subsystems/external>; Events API: lớp gốc `public/lib/classes/event/base.php` trong mã nguồn Moodle.
