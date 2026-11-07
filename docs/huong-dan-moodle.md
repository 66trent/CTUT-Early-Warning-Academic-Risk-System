# Hướng dẫn Moodle demo (Phase 10a)

Moodle 5.3 LTS chạy bằng Docker ở máy, giả lập Moodle của trường để thử đồng bộ điểm danh / trắc nghiệm / thực hành sang CTUT-EWARS. Thiết kế: `docs/tich-hop-moodle.md`. Giao diện Moodle mặc định tiếng Anh — hướng dẫn ghi đúng nhãn tiếng Anh trong ngoặc kép.

## 1. Khởi động

```bash
npm run moodle:up
```

Lần đầu build image + cài Moodle mất ~5 phút. Xong khi http://localhost:8080 hiện trang đăng nhập. Cần Docker Desktop và `.env` có `MOODLE_DB_PASSWORD`, `MOODLE_ADMIN_PASSWORD`, `MOODLE_DEMO_PASSWORD` (đã sinh sẵn ở máy này).

Chọn **1 trong 2 cách** chuẩn bị dữ liệu:

```bash
npm run moodle:setup
```

**Cách A — dựng sẵn**: web service chỉ đọc + token (ghi vào `.env`), học kỳ `HK1_2026` trong EWARS, và 2 khóa học demo có dữ liệu đến **ngày chốt** (mặc định hôm qua; chọn ngày khác: `-- --cutoff=YYYY-MM-DD`, trong khoảng 05/11–20/12/2026) — mục 3.

```bash
npm run moodle:setup -- --manual
```

**Cách B — tự làm tay**: như trên nhưng chỉ tạo tài khoản (1 giảng viên + 20 sinh viên KTPM2411); khóa học, buổi điểm danh, bài trắc nghiệm, bài thực hành bạn tự tạo theo mục 4.

**Trước buổi trình diễn: `npm run moodle:setup -- --reset`** (dựng lại theo ngày chốt mới — nếu để bản dựng cũ, bài "chương 3" có thể đã quá hạn và cả lớp bị báo bỏ bài). Khác: `-- --reset` xóa 2 khóa học demo rồi dựng lại · `-- --rotate-token` đổi token · `npm run moodle:down` tắt Moodle (giữ dữ liệu). Chạy `npm run demo:reset` của EWARS xong thì chạy lại `npm run moodle:setup` (tạo lại học kỳ `HK1_2026`; khóa học có rồi sẽ được giữ nguyên).

## 2. Tài khoản

| Vai | Tên đăng nhập | Mật khẩu (trong `.env`) |
|---|---|---|
| Quản trị Moodle | `admin` | `MOODLE_ADMIN_PASSWORD` |
| Giảng viên | `gv.moodle` | `MOODLE_DEMO_PASSWORD` |
| Sinh viên | MSSV viết thường, VD `ktpm2411903` | `MOODLE_DEMO_PASSWORD` |
| Dịch vụ EWARS | `ewars_sync` (chỉ dùng token, không đăng nhập giao diện) | — |

Mỗi vai 1 cửa sổ trình duyệt (cửa sổ ẩn danh cho sinh viên) để khỏi đăng xuất qua lại.

## 3. Dữ liệu dựng sẵn (cách A)

Học kỳ `HK1_2026` (17/08–27/12/2026, giá trị demo), danh mục Moodle "HK1 2026–2027", lớp KTPM2411 (20 sinh viên bộ v3). Mọi mốc đặt **tương đối với ngày chốt** để kết quả mong đợi không đổi dù dựng ngày nào. Mỗi khóa học: 15 buổi × 200 phút (4 tiết) = 60 tiết, đã điểm danh 12 buổi đến 06/11; 3 bài trắc nghiệm (10 câu Đúng/Sai, hạn 15/09, 13/10, 24/11); 3 bài thực hành (hạn 22/09, 20/10, 30/11).

| Khóa học (Course ID number) | Sinh viên tình huống | Dự kiến EWARS báo (khi có Phase 10b) |
|---|---|---|
| Mạng máy tính `010100089201` | 903 vắng không phép 4 buổi (16/60 tiết) | ATT-01 Rất cao |
| | 906 vắng có phép 2 buổi (8/60) | ATT-01 Trung bình |
| | 907 không nộp Thực hành 1, 2 | LMS-03 Cao |
| | 909 nộp trễ Thực hành 1, 2 | LMS-04 Thấp |
| | 915 được gia hạn Thực hành 2 tới ngày chốt + 7 ngày, chưa nộp | Không cảnh báo |
| | 917 làm dở Trắc nghiệm 2, quá hạn không nộp | LMS-01 Trung bình |
| Hệ điều hành `010100089101` | 904 vắng không phép 2 buổi gần ngày chốt nhất | ATT-01 TB + ATT-02 Cao (cần chốt ở Phase 10b cách ATT-02 so ngày chốt) |
| | 905 không làm Trắc nghiệm 1, 2 | LMS-01 Cao |
| | 911 điểm Trắc nghiệm 1, 2 = 4 và 3 / 10 | LMS-02 Trung bình |
| | 913 vắng 2 buổi + không nộp Thực hành 1 | ATT-01 TB + LMS-03 TB → COMB-01 Rất cao |
| | 919 làm Trắc nghiệm 1 hai lần (5 rồi 9 điểm) | Không cảnh báo (lấy lượt cao nhất) |

Sinh viên khác: đi học đủ, trắc nghiệm 7–10 điểm, nộp đúng hạn. Nội dung sinh bởi `scripts/lib/moodle-demo-spec.ts` (đừng sửa tay JSON): `moodle:setup` ghi bản theo ngày chốt vào `docs/demo-data/moodle/moodle-demo.local.json` (không commit); `npm run moodle:spec` ghi bản trong repo `moodle-demo.json` (ngày chốt 06/11/2026 — dùng cho fixture/test). Bảng "dự kiến" sẽ thành kết quả mong đợi chính thức ở Phase 10b.

## 4. Tự làm tay trên Moodle (cách B, hoặc thêm dữ liệu sau ngày chốt)

**4 quy ước bắt buộc để EWARS nhận đúng** (đã chốt 2026-11-07, không xác minh với trường):

1. **Course ID number** của khóa học = mã lớp học phần 12 số (VD `010100089301`); EWARS tự suy mã học phần = bỏ 2 số cuối (`0101000893`).
2. **ID number** của sinh viên = MSSV **đã có trong EWARS**; email giống email trong danh sách sinh viên EWARS (dự phòng khi ID number trống).
3. Mọi ngày (buổi học, hạn nộp) nằm trong học kỳ `HK1_2026` (17/08–27/12/2026).
4. Điểm danh: 1 tiết = 50 phút (buổi 3 tiết = 2 giờ 30 phút); ký hiệu `P` có mặt, `L` đi trễ (tính có mặt), `E` vắng có phép, `A` vắng không phép.

### 4.1 Tạo khóa học (đăng nhập `admin`)

1. "Site administration" → "Courses" → "Add a new course".
2. "Course full name" (VD Cơ sở dữ liệu nâng cao (nhóm 01)), "Course short name" (không trùng), "Course category" = HK1 2026–2027, **"Course ID number"** = mã lớp học phần, "Course start date" / "Course end date" trong học kỳ → "Save and display".
3. "Participants" → "Enrol users": chọn sinh viên (vai "Student") và `gv.moodle` (vai "Teacher") → "Enrol users".

Thêm sinh viên mới: "Site administration" → "Users" → "Add a new user" — "Username", mật khẩu, họ tên, email; mở mục "Optional" → **"ID number"** = MSSV. MSSV phải có trong EWARS (nạp danh sách sinh viên trước), nếu không EWARS sẽ báo dòng lỗi "không có sinh viên".

### 4.2 Điểm danh (đăng nhập `gv.moodle`)

1. Vào khóa học → bật "Edit mode" → "Add content" (bảng chọn hoạt động) → "Attendance" → đặt tên → "Save and display".
2. "Add session": ngày + giờ bắt đầu, **"Duration"** (VD 3 giờ 20 phút = 4 tiết). Muốn tạo cả lịch học kỳ: tích "Create multiple sessions" → "Repeat on" thứ trong tuần, "Repeat every" 1 tuần, "Repeat until" cuối học kỳ → "Add".
3. Mỗi buổi đã dạy: biểu tượng "Take attendance" → chọn `P`/`L`/`E`/`A` cho từng sinh viên → "Save attendance".

EWARS lấy **tổng số tiết** = tổng thời lượng mọi buổi đã tạo ÷ 50 phút — nên tạo đủ lịch cả học kỳ (hoặc Admin ghi đè ở EWARS, Phase 10b).

### 4.3 Bài trắc nghiệm

1. "Add content" (bảng chọn hoạt động) → "Quiz" → tên bài; mục "Timing": "Open the quiz" + **"Due date"** (hạn nộp — EWARS dùng để biết bài đã quá hạn); "Grade" → "Maximum grade" 10 → "Save and display".
2. "Questions" → "Add" → "+ a new question" → "True/False" (hoặc loại khác) → soạn vài câu.
3. Sinh viên (cửa sổ ẩn danh, đăng nhập MSSV): vào bài → "Attempt quiz" → trả lời → "Finish attempt…" → "Submit all and finish". Bỏ dở = không bấm nộp.

### 4.4 Bài thực hành

1. "Add content" (bảng chọn hoạt động) → "Assignment" → tên bài; "Availability": "Allow submissions from" + **"Due date"** ("Cut-off date" tùy chọn); "Submission types": "Online text" hoặc "File submissions".
2. Mục "Submission settings": **"Require students to click the submit button" = No** (nếu Yes, bài lưu nháp chưa bấm nộp được tính là **chưa nộp** — đúng cách Moodle hiểu).
3. Sinh viên: vào bài → "Add submission" → "Save changes". Nộp sau "Due date" = nộp trễ.
4. Gia hạn riêng: giảng viên → "View all submissions" → menu "Edit" của sinh viên → "Grant extension". EWARS không báo "không nộp" cho sinh viên đang trong hạn gia hạn.

## 5. Kiểm tra nhanh

- Web service + token: `npm run moodle:setup` in dòng "Moodle 5.3 …, tài khoản ewars_sync, 11 hàm được cấp".
- Ghi lại JSON mẫu cho test: `npm run moodle:setup -- --reset --cutoff=2026-11-06` rồi `npm run moodle:fixtures` → `tests/fixtures/moodle/` (đủ 20 sinh viên + `_meta.json`; kiểm luôn quyền đọc dữ liệu mọi sinh viên). Xong thì `npm run moodle:setup -- --reset` để về ngày chốt hôm qua.
- **Đồng bộ sang EWARS (Phase 10b — Chạy tay)**: đăng nhập Admin EWARS → menu **Kết nối Moodle** → chọn học kỳ **Học kỳ 1, 2026–2027** → bảng "Khóa học trên Moodle": **Bật đồng bộ** 2 khóa → **Đồng bộ ngay** (vài giây, trang tự cập nhật) → kiểm 3 lô (Điểm danh / Bài trắc nghiệm / Bài thực hành, bấm tên để xem từng dòng) → **Xác nhận nạp cả 3** → **Chạy đánh giá** (chọn học kỳ 2026–2027, mốc = ngày chốt) → kết quả như mục 3. Sửa dữ liệu trên Moodle rồi bấm Đồng bộ ngay lại: chỉ file thay đổi được nạp. Chế độ Tự động (thời gian thực): Phase 10c.

## 6. Giới hạn của Moodle demo

Chỉ để phát triển / trình diễn: chạy http, `wwwroot` theo tên máy trong danh sách cho phép, không gửi email (`noemailever`), Apache trong ảnh chính thức của MoodleHQ chạy tiến trình chính bằng root (ngoại lệ của `06` — không phải image production của EWARS). Dữ liệu sinh bằng bộ sinh dữ liệu thử của Moodle rồi đặt lại thời điểm trong DB — giống dữ liệu thật ở phần web service trả về, không có nhật ký sự kiện cũ.
