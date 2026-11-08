# Kịch bản thuyết trình bảo vệ đồ án — CTUT-EWARS (bản Moodle trọng tâm)

> Tài liệu này để **đọc thành tiếng và tập nói**. Đoạn in nghiêng là lời nói nguyên văn; chữ trong ngoặc vuông `[ ]` là việc làm (chuyển slide, bấm, chờ), không đọc ra.
> Tổng thời lượng: **thuyết trình ~13 phút + demo ~14 phút + hỏi đáp**. Trọng tâm: **dữ liệu từ Moodle về EWARS gần thời gian thực → tự đánh giá → chuông báo cố vấn**.
> Số liệu Moodle khớp `docs/demo-data/moodle/KET_QUA_MONG_DOI.md`; số liệu nhập file khớp `docs/demo-data/KET_QUA_MONG_DOI.md` (đều có test tự động). Đừng tự đổi số.
> Bản cũ (nhập file là trọng tâm) xem lịch sử Git của file này hoặc `docs/demo-script.md` mục "Kịch bản nhập file".

---

## Phần 0 — Đọc trước khi tập (5 phút)

### 0.1 Bảy mẹo cho người chưa quen thuyết trình

1. **Không học thuộc từng chữ.** Học thuộc **câu mở đầu và câu kết** của mỗi phần; ở giữa nhìn 3 từ khóa in đậm là đủ.
2. **Nói chậm hơn bạn nghĩ.** Mỗi khi chuyển slide: hít 1 hơi, đếm thầm "một, hai", rồi mới nói.
3. **Một câu = một ý.** Kịch bản đã cắt câu ngắn sẵn.
4. **Nhìn hội đồng ở đầu và cuối mỗi câu,** nhìn màn hình ở giữa câu.
5. **Quên lời thì đọc tiêu đề slide** rồi nói "Ý chính ở đây là…".
6. **Câu hỏi khó được phép dừng 3 giây:** *"Dạ, em xin phép suy nghĩ một chút."*
7. **Tập 3 lần:** đọc to theo giấy → chỉ nhìn từ khóa + bấm giờ → nói trước 1 người bạn và nhờ hỏi bất kỳ câu nào ở Phần 4. **Phần chờ chuông (M6) phải tập ít nhất 2 lần** để quen lấp khoảng 30–60 giây.

### 0.2 Hệ thống trong 1 câu (thuộc lòng)

> *"CTUT-EWARS lấy dữ liệu điểm danh, bài trắc nghiệm, bài thực hành từ Moodle gần như ngay khi giảng viên và sinh viên thao tác, kết hợp kết quả học phần, dùng 12 luật nghiệp vụ để phát hiện sớm sinh viên có dấu hiệu rủi ro, rồi báo ngay cho cố vấn học tập — hệ thống chỉ cảnh báo tham khảo, không bao giờ tự quyết định học vụ."*

### 0.3 Từ khó → cách nói dễ hiểu

| Thuật ngữ | Khi nói, dùng câu này |
|---|---|
| Moodle | "hệ thống học trực tuyến trường đang dùng — nơi giảng viên điểm danh, ra bài, sinh viên làm bài" |
| Web service chỉ đọc | "cửa đọc dữ liệu Moodle cấp cho EWARS — chỉ đọc được, không ghi gì vào Moodle" |
| Plugin `local_ewars` / sự kiện | "một mẩu nhỏ cài trên Moodle, có thay đổi là **bấm chuông** báo EWARS — chuông chỉ có mã số, không có điểm hay tên" |
| Chế độ Thủ công / Tự động | "Thủ công: xem trước rồi mới nhập. Tự động: có thay đổi là tự nhập, tự đánh giá" |
| Gần thời gian thực | "khoảng nửa phút đến hai phút, không phải tức thì từng giây" |
| Rule engine | "bộ máy chạy luật" — đọc dữ liệu, so với ngưỡng, ra dấu hiệu |
| Dấu hiệu / Cảnh báo | "một lần một luật đúng với một sinh viên" / "hồ sơ cố vấn thấy — gom mọi dấu hiệu của 1 sinh viên trong 1 học kỳ" |
| RiskScore | "con số 0–1 để sắp xếp ai cần xem trước — không tạo cảnh báo" |
| asOf / mốc dữ liệu | "ngày ta giả sử đang đứng — chỉ dùng dữ liệu đến ngày đó" |
| Worker / hàng đợi | "phần chạy ngầm, xử lý việc nặng để giao diện không bị treo" |
| Phân quyền theo phạm vi | "cố vấn chỉ thấy sinh viên lớp mình, kiểm ở máy chủ chứ không chỉ ẩn nút" |

---

## Phần 1 — Dàn slide (16 slide)

| # | Tiêu đề slide | Nội dung trên slide (ít chữ) | Thời gian |
|---|---|---|---|
| 1 | Tên đề tài | Tên, sinh viên, GVHD | 0:20 |
| 2 | Vấn đề | phát hiện muộn · dữ liệu rời rạc (Moodle, điểm danh, điểm) · cố vấn quá tải | 0:50 |
| 3 | Mục tiêu và ranh giới | 4 việc làm · 1 việc KHÔNG làm | 0:50 |
| 4 | Người dùng | Sinh viên · Cố vấn học tập · Quản trị | 0:40 |
| 5 | Dữ liệu đầu vào | Moodle: điểm danh · trắc nghiệm · thực hành — File: kết quả học phần, danh sách SV | 0:50 |
| 6 | Kết nối Moodle | Sơ đồ: Moodle → chuông báo (plugin) → EWARS đọc lại (chỉ đọc) → nhập → đánh giá → chuông cố vấn | 1:30 |
| 7 | "Thời gian thực" nghĩa là gì | Bảng độ trễ + lưới an toàn | 1:00 |
| 8 | 12 luật | 4 nhóm: Điểm danh · LMS · Học lực · Kết hợp | 1:20 |
| 9 | Từ dấu hiệu đến cảnh báo | dữ liệu → luật → dấu hiệu → cảnh báo → cố vấn → sinh viên; tự mở lại | 0:50 |
| 10 | Điểm ưu tiên và thiếu dữ liệu | 0,4 / 0,3 / 0,3 · Đủ / Một phần / Chưa đủ | 0:40 |
| 11 | Kiến trúc | Next.js · PostgreSQL · Worker + Redis · MinIO · Docker · Moodle 5.3 | 0:50 |
| 12 | Bảo mật và pháp lý | Token chỉ đọc · chữ ký HMAC · phân quyền theo lớp · nhật ký · Luật 91/2025 | 0:50 |
| 13 | Kiểm thử | 472 test · nghiệm thu Moodle khớp 100% · đo 34 giây | 0:40 |
| 14 | Dữ liệu demo | Moodle: lớp KTPM2411, 2 khóa, HK1 2026–2027 · Bộ nhập file: 5 lớp × 20 SV | 0:30 |
| 15 | (Demo trực tiếp) | — | 14:00 |
| 16 | Giới hạn · Hướng phát triển · Kết luận | 4 + 3 gạch | 1:20 |

**Slide 6 — sơ đồ nên vẽ (trái → phải):**

```
Giảng viên điểm danh / SV nộp bài trên Moodle
        │ ① plugin local_ewars bấm "chuông" (chỉ mã số, ký HMAC)   ≤ 1 phút
        ▼
EWARS nhận chuông → gom 30 giây
        │ ② EWARS tự đọc lại dữ liệu qua web service CHỈ ĐỌC       vài giây
        ▼
Sinh file đúng mẫu → kiểm tra → tự nhập (lỗi ≤ 10%)
        │ ③ chạy 12 luật                                           vài giây
        ▼
Cảnh báo mới / tăng mức / mở lại → 🔔 chuông Admin + Cố vấn, email Cố vấn
```

**Slide 7 — bảng nên đặt:**

| Trên Moodle | EWARS cập nhật sau |
|---|---|
| Điểm danh trên web, nộp / làm bài, sửa bài / hạn nộp | 30 giây – 2 phút (đo được **34 giây**) |
| Điểm danh bằng app di động (không phát sự kiện) | ≤ 10 phút (lịch dò thay đổi) |
| Hết hạn nộp mà chưa nộp | đúng hạn + 5 phút |
| Sự kiện bị lỡ, máy chủ khởi động lại | lịch dò 10 phút + đồng bộ đầy đủ mỗi đêm |

---

## Phần 2 — Lời nói theo từng slide (~13 phút)

### Slide 1 — Mở đầu (0:20)

*"Em kính chào quý thầy cô trong hội đồng. Em tên là [họ tên], sinh viên lớp [lớp]. Hôm nay em xin trình bày đồ án: **Hệ thống cảnh báo sớm rủi ro học tập dựa trên luật nghiệp vụ**, tên viết tắt là CTUT-EWARS. Giảng viên hướng dẫn là [thầy/cô …]."*

*"Phần trình bày gồm ba phần: vấn đề và giải pháp; demo trực tiếp khoảng mười bốn phút, trong đó em cho thầy cô xem dữ liệu đi từ Moodle sang hệ thống trong vòng một phút; cuối cùng là giới hạn và hướng phát triển."*

[Dừng 2 giây. Chuyển slide.]

### Slide 2 — Vấn đề (0:50)

*"Thưa hội đồng, một sinh viên thường chỉ bị phát hiện gặp khó khăn **khi đã quá muộn** — đã bị cấm thi, đã rớt môn, hoặc đã bị cảnh báo học tập."*

*"Thật ra dấu hiệu có từ sớm: vắng học tăng dần, bỏ bài trắc nghiệm, không nộp bài thực hành. Những dấu hiệu này **nằm ngay trong Moodle** — nhưng Moodle một nơi, điểm một nơi, và cố vấn học tập thì **không có thời gian** mở từng khóa học để soi từng sinh viên."*

*"Câu hỏi của em: làm sao để dữ liệu **tự chảy** về một chỗ, và hệ thống **tự chỉ ra** sinh viên nào cần quan tâm — ngay khi dấu hiệu xuất hiện, chứ không phải cuối kỳ?"*

### Slide 3 — Mục tiêu và ranh giới (0:50)

*"Hệ thống làm đúng bốn việc: phát hiện dấu hiệu; tạo cảnh báo sớm; báo cho cố vấn học tập; và cho cố vấn xác nhận, ghi lại việc đã hỗ trợ."*

*"Có **một việc hệ thống không bao giờ làm**: tự sửa tình trạng học vụ chính thức của sinh viên. Mọi cảnh báo là **tham khảo**. Với Moodle cũng vậy: EWARS **chỉ đọc**, không bao giờ ghi gì vào Moodle."*

### Slide 4 — Người dùng (0:40)

*"Ba vai trò. **Sinh viên** đăng nhập Google bằng email trường, chỉ xem dữ liệu của mình. **Cố vấn học tập** chỉ thấy sinh viên lớp mình phụ trách. **Quản trị viên** kết nối Moodle, nhập file, cấu hình luật; xem được mọi cảnh báo nhưng **chỉ đọc**, không xử lý thay cố vấn."*

### Slide 5 — Dữ liệu đầu vào (0:50)

*"Ba nguồn học tập hằng tuần — **điểm danh**, **bài trắc nghiệm**, **bài thực hành** — lấy **trực tiếp từ Moodle**. Điểm danh dùng plugin Attendance phổ biến nhất của Moodle; Moodle ghi theo buổi có thời lượng, em quy đổi ra tiết: một tiết năm mươi phút."*

*"Còn **kết quả học phần** — điểm chính thức đã khóa — không nằm trong Moodle, nên vẫn nhập bằng file CSV hoặc Excel, qua hai bước: xem trước rồi mới xác nhận. Đường nhập file vẫn dùng song song khi trường chưa dùng Moodle cho một môn nào đó."*

### Slide 6 — Kết nối Moodle (1:30)

*"Đây là phần em muốn nhấn mạnh nhất. Em dùng **hai kênh**."*

[Chỉ ①.] *"Kênh thứ nhất: em viết một plugin nhỏ cài trên Moodle. Khi giảng viên điểm danh hay sinh viên nộp bài, plugin **bấm chuông** báo EWARS. Cái chuông này **chỉ có tên sự kiện và mã số** — không có điểm, không có họ tên — và được **ký bằng khóa bí mật**, nên kẻ khác không giả mạo được."*

[Chỉ ②.] *"Kênh thứ hai: nhận chuông xong, EWARS **tự đọc lại dữ liệu** qua cửa web service **chỉ đọc** mà Moodle cấp. Nghĩa là EWARS không tin nội dung chuông — kể cả chuông giả cũng không ghi được dữ liệu sai."*

[Chỉ ③.] *"Dữ liệu đọc về được chuyển thành đúng mẫu file mà trường đang dùng, đi qua đúng bước kiểm tra như nhập file, rồi **tự chạy 12 luật**. Có cảnh báo mới, tăng mức hay mở lại thì **chuông của cố vấn kêu**, kèm email."*

*"Có hai chế độ cho mỗi khóa học: **Thủ công** — lần đầu kết nối, quản trị viên xem trước rồi mới nhập; và **Tự động** — dùng hằng ngày. Ở chế độ Tự động, đợt nhập nào lỗi quá 10% thì hệ thống **không tự nhập** mà dừng chờ quản trị viên xem."*

### Slide 7 — "Thời gian thực" nghĩa là gì (1:00)

*"Em xin nói trung thực: đây là **gần thời gian thực**, không phải tức thì từng giây."*

[Chỉ bảng.] *"Giảng viên điểm danh trên web hay sinh viên nộp bài: khoảng nửa phút đến hai phút — vì Moodle chạy tác vụ nền mỗi phút, em gom các sự kiện trong 30 giây thành một lần. Em đo thật được **34 giây**."*

*"Có một điều thú vị: việc **không nộp bài** thì Moodle không phát sự kiện nào cả — vì không ai làm gì. Nên với mỗi bài có hạn nộp, EWARS **hẹn giờ** chạy lại đúng **hạn nộp cộng 5 phút**."*

*"Và để không bỏ sót: mỗi 10 phút EWARS dò xem khóa học có gì thay đổi không — chỉ gọi vài hàm nhẹ, có thay đổi mới đọc đầy đủ; mỗi đêm đồng bộ lại toàn bộ. Khi em thử tắt máy chủ giữa chừng, các lưới an toàn này tự gom lại phần bị lỡ."*

### Slide 8 — 12 luật (1:20)

*"Phần lõi là mười hai luật, bốn nhóm."*

*"**Điểm danh** hai luật: ATT-01 vắng từ 10% mức trung bình, 15% cao, **vượt 20% rất cao** — vì quy chế quy định vắng quá 20% bị cấm thi; ATT-02 vắng không phép **tăng nhanh** trong 14 ngày."*

*"**LMS** bốn luật: bỏ bài trắc nghiệm, điểm trắc nghiệm dưới 50%, không nộp bài thực hành, nộp trễ nhiều lần. Bốn luật này nay lấy dữ liệu thẳng từ Moodle."*

*"**Học lực** bốn luật: rớt học phần, tỷ lệ tín chỉ rớt cao, điểm trung bình học kỳ thấp, sa sút so với học kỳ trước — dữ liệu từ file kết quả học phần."*

*"**Kết hợp** hai luật: hai nguồn trở lên cùng xấu trong một học phần; học lại mà vẫn có dấu hiệu."*

*"Ngưỡng có hai loại: **theo quy chế** — như 20% vắng — lấy từ Quy chế 336; và **báo sớm** — 10%, 15% — em đề xuất, **chưa hiệu chỉnh bằng dữ liệu thật**. Quản trị viên đổi được trên giao diện, có phiên bản và chạy thử."*

### Slide 9 — Từ dấu hiệu đến cảnh báo (0:50)

*"Mỗi lần một luật đúng với một sinh viên là một **dấu hiệu**. Cố vấn không thấy từng dấu hiệu rời rạc: hệ thống **gom** mọi dấu hiệu của một sinh viên trong học kỳ thành **một cảnh báo**, mức là mức **cao nhất**."*

*"Cảnh báo có vòng đời: mới, đã xem, đang xử lý, đã giải quyết. Đã giải quyết mà sinh viên **xấu hơn** thì cảnh báo **tự mở lại**. Em sẽ cho thầy cô xem đúng tình huống này với dữ liệu đi từ Moodle."*

*"Sinh viên chỉ thấy cảnh báo **sau khi cố vấn xác nhận** — để nhận thông tin kèm sự hỗ trợ."*

### Slide 10 — Điểm ưu tiên và thiếu dữ liệu (0:40)

*"Mỗi sinh viên có điểm ưu tiên 0 đến 1: điểm danh 0,4, LMS 0,3, học lực 0,3 — chỉ để **sắp xếp**, không tạo cảnh báo. Không có dữ liệu thì hệ thống ghi **Chưa đủ dữ liệu**, **không** coi là rủi ro thấp."*

### Slide 11 — Kiến trúc (0:50)

*"Next.js cho cả giao diện và máy chủ, PostgreSQL lưu dữ liệu. Việc nặng — đọc Moodle, nhập dữ liệu, chạy luật — nằm trong **hàng đợi** và một tiến trình chạy ngầm riêng, nên giao diện không bị treo. File gốc lưu ở MinIO."*

*"Để demo, em tự dựng **Moodle 5.3** — bản ổn định mới nhất — cùng plugin điểm danh, chạy trong Docker cạnh hệ thống, giả lập Moodle của trường. Toàn bộ dựng lại được bằng vài lệnh."*

### Slide 12 — Bảo mật và pháp lý (0:50)

*"Với Moodle: token chỉ gọi được **11 hàm đọc**, để trong biến môi trường, không lưu vào cơ sở dữ liệu, không ghi log. Chuông báo được **ký HMAC**, lệch giờ quá 5 phút bị từ chối để chống gửi lại, mỗi chuông có mã riêng nên nhận trùng không xử lý hai lần. EWARS chỉ lấy mã sinh viên, email, thời gian, điểm, trạng thái — **không lấy họ tên, ảnh, nội dung bài làm**."*

*"Phân quyền **kiểm ở máy chủ**, có test chứng minh cố vấn lớp A không xem được lớp B. Mọi thao tác quan trọng ghi **nhật ký không sửa, không xóa được** — kể cả việc đồng bộ tự động, ghi dưới tên 'Đồng bộ Moodle (hệ thống)'. Căn cứ Luật Bảo vệ dữ liệu cá nhân 91/2025."*

### Slide 13 — Kiểm thử (0:40)

*"Hệ thống có **472 test tự động** chạy trên cơ sở dữ liệu thật. Với Moodle, em ghi lại phản hồi thật của Moodle 5.3 làm dữ liệu mẫu, rồi dựng **máy chủ Moodle giả** để test không phụ thuộc mạng: đồng bộ phải ra đúng 480, 121, 120 dòng và đúng **12 dấu hiệu, 9 cảnh báo** tính tay trước. Có test cho cả các tình huống xấu: nhận trùng sự kiện, đợt nhập nhiều lỗi, dữ liệu cũ đè dữ liệu mới, máy chủ dừng giữa chừng."*

*"Đo thực tế trên Moodle Docker: giảng viên điểm danh vắng đến lúc cảnh báo đổi mức là **34 giây**; hết hạn nộp đến lúc đánh giá lại là **đúng 5 phút**."*

### Slide 14 — Dữ liệu demo (0:30)

*"Phần Moodle: lớp Kỹ thuật phần mềm 2411, hai khóa học Mạng máy tính và Hệ điều hành, học kỳ 1 năm 2026–2027 theo ngày thật. Mỗi khóa 15 buổi, 3 bài trắc nghiệm, 3 bài thực hành; em cài sẵn khoảng mười tình huống: vắng vượt ngưỡng, vắng tăng nhanh, bỏ bài, điểm thấp, nộp trễ, được gia hạn."*

*"Phần học lực: bộ dữ liệu năm lớp, một trăm sinh viên của học kỳ trước, nhập bằng file. Họ tên, mã số đều là giả."*

*"Sau đây em xin demo."*

[Chuyển sang trình duyệt. Hít một hơi.]

---

## Phần 3 — Lời nói khi demo (~14 phút)

### Chuẩn bị (sáng hôm bảo vệ, ≥ 30 phút trước)

**Chạy trên Docker cho ổn định** (app + worker trong Docker, image build theo code mới nhất):

1. `.env` có `MOODLE_EVENTS_BASE_URL=http://app:3000` (Moodle gọi app trong cùng mạng Docker).
2. Dựng mọi thứ:

```bash
docker compose --profile dev --profile moodle up -d --build
```

3. Dữ liệu sạch cho buổi bảo vệ (bộ nhập file v3 nhập sẵn, chưa chạy đánh giá):

```bash
npm run demo:reset -- --yes
```

4. Dựng lại Moodle demo theo ngày chốt hôm qua + cài URL / khóa bí mật cho plugin:

```bash
npm run moodle:setup -- --reset
```

5. Đăng nhập Admin EWARS → **Học kỳ** → dòng **Học kỳ 1, 2026–2027** → **Đặt làm hiện tại** (để Cố vấn và Sinh viên mở là thấy học kỳ Moodle).
6. **Kiểm tra bẫy cổng 3000:** `docker ps` chỉ có **một** `ewars-app-1`; không chạy `npm run dev` / worker ở máy cùng lúc (Docker tự bật lại container cũ là lỗi đã gặp: app cũ trả 404 cho chuông Moodle).
7. Chạy thử 1 vòng M6 **trước giờ bảo vệ ít nhất 1 ngày** rồi làm lại bước 3–5 (dữ liệu về đầu).

> **Giới hạn ngày:** dữ liệu Moodle demo hợp lệ khi ngày chốt (hôm qua) nằm trong **05/11–20/12/2026**. Bảo vệ sau 20/12 thì báo trước để dựng học kỳ demo mới.

**Cửa sổ trên máy (mỗi vai đăng nhập 1 lần — đăng nhập nhanh giới hạn 10 lần/phút):**

| Cửa sổ | Vai | Mở sẵn trang |
|---|---|---|
| Chrome thường | Quản trị viên EWARS | `/admin/moodle` |
| Edge | Cố vấn **GV001** (lớp KTPM2411) | `/advisor` |
| Chrome ẩn danh | Sinh viên **KTPM2411903** | `/student` |
| Firefox | Moodle `http://localhost:8080`, tài khoản **gv.moodle** (mật khẩu `MOODLE_DEMO_PASSWORD` trong `.env`) | khóa **Mạng máy tính (nhóm 01)** → hoạt động **Điểm danh** |
| Tab phụ | MailHog `http://localhost:8025` | — |
| Terminal | Lệnh dự phòng M6 (Phần 5) | — |

Bố trí Edge (cố vấn) và Firefox (Moodle) **cạnh nhau** trên màn chiếu ở bước M6 để hội đồng thấy cả hai.

Video quay sẵn trọn phần demo trong USB/desktop — máy trục trặc thì mở video, nói y như dưới.

### M1 — Đăng nhập + Moodle là gì (0:00 → 1:30)

[Cửa sổ Firefox — Moodle, khóa Mạng máy tính.]

*"Đây là Moodle 5.3 em dựng giống Moodle của trường. Khóa Mạng máy tính nhóm 01 — mã lớp học phần 010100089201 ghi ở ô Course ID number. Trong khóa có hoạt động **Điểm danh** — 15 buổi, mỗi buổi 200 phút tức 4 tiết, đã điểm danh 12 buổi; có **3 bài trắc nghiệm** và **3 bài thực hành**, mỗi bài có hạn nộp."*

[Bấm Điểm danh → tab buổi học, chỉ cột trạng thái P / A / E / L.]

*"Giảng viên điểm danh theo ký hiệu: P có mặt, L đi trễ, E vắng có phép, A vắng không phép. Toàn bộ dữ liệu này đang **nằm trong Moodle** — EWARS chưa có gì."*

### M2 — Kết nối Moodle, đồng bộ Thủ công (1:30 → 4:00)

[Chrome — Admin EWARS → **Kết nối Moodle**.]

*"Đây là trang Kết nối Moodle của quản trị viên. Thẻ trên cùng: **Đã kết nối** Moodle 5.3, tài khoản đồng bộ, **11 hàm chỉ đọc** được cấp."*

[Chọn chip **Học kỳ 1, 2026–2027**. Bảng "Khóa học trên Moodle".]

*"EWARS đọc danh sách khóa học trên Moodle. Chỉ khóa có mã lớp học phần 12 chữ số mới bật được. Em bật hai khóa Mạng máy tính và Hệ điều hành."*

[Bấm **Bật đồng bộ** ở 2 khóa (xác nhận). Bấm **Đồng bộ ngay**. Chờ ~10 giây.]

*"Lần kết nối đầu tiên em dùng chế độ **Thủ công**: hệ thống đọc Moodle, chuyển thành ba đợt nhập — điểm danh, trắc nghiệm, thực hành — nhưng **chưa ghi** gì cả."*

[Kết quả: 3 đợt nhập.] *"Khoảng 480 dòng điểm danh"* (số này tăng theo số buổi đã học), *"121 dòng trắc nghiệm, 120 dòng thực hành, **0 lỗi**."*

[Bấm tên đợt nhập **Điểm danh** → màn xem trước, chỉ cột tổng số tiết = 60.]

*"Mỗi ngày có buổi điểm danh thành một ngày chốt; tổng số tiết 60 — tức 15 buổi nhân 200 phút chia 50 phút một tiết. Đây là chỗ duy nhất phải quy đổi."*

[Quay lại Kết nối Moodle → **Xác nhận nhập cả 3** → xác nhận.]

### M3 — Chạy đánh giá, chuông Admin (4:00 → 5:00)

[**Chạy đánh giá** → Học kỳ 1, 2026–2027 → để trống mốc (= bây giờ) → Chạy.]

*"Ở chế độ Thủ công, em bấm chạy đánh giá."* [Kết quả.] *"**12 dấu hiệu, 9 cảnh báo** trong 20 sinh viên — đúng bảng em tính tay trước."*

[Chỉ chuông góc trên — có số đỏ. Mở chuông.]

*"Quản trị viên vừa có chuông: **đánh giá đã cập nhật** — nguồn, số sinh viên, số cảnh báo mới. Cố vấn của lớp cũng có chuông riêng cho lớp mình. Chuông tự cập nhật mỗi 15 giây."*

### M4 — Cố vấn GV001 xử lý (5:00 → 7:00)

[Edge — Cố vấn GV001. Chuông có số → mở: "Admin chạy đánh giá · Lớp KTPM2411: 9 cảnh báo mới".]

*"Cố vấn lớp Kỹ thuật phần mềm thấy ngay 9 cảnh báo mới của lớp mình."* [Mở **Cảnh báo sớm**.]

[Mở **KTPM2411903**.] *"Sinh viên 903 vắng không phép **16 trên 60 tiết — 26,7%**, vượt ngưỡng cấm thi 20%, mức **Rất cao**."* [Bấm **Xác nhận đã xem** → **Ghi can thiệp** (VD: Gọi điện) → Lưu.]

[Mở **KTPM2411906**.] *"Sinh viên 906 vắng **có phép** 8 tiết — 13,3%, mức Trung bình. Giả sử cố vấn đã gặp, sinh viên có giấy ốm, đã nhắc đi học đầy đủ."* [**Xác nhận đã xem** → **Ghi can thiệp** → **Đánh dấu đã giải quyết**.]

*"Muốn đánh dấu đã giải quyết thì bắt buộc phải ghi can thiệp. Em sẽ quay lại sinh viên 906 ngay sau đây."*

### M5 — Sinh viên xem + bật Tự động (7:00 → 8:00)

[Chrome ẩn danh — Sinh viên KTPM2411903 → tải lại trang.]

*"Sinh viên 903 thấy cảnh báo **vì cố vấn vừa xác nhận**; trước đó bạn ấy không thấy gì. Sinh viên không nhận email."*

[Chrome — Admin → Kết nối Moodle → **Bật Tự động** ở 2 khóa (xác nhận).]

*"Bây giờ em chuyển hai khóa sang **Tự động**. Hệ thống chỉ cho bật khi khóa đã được xác nhận nhập ít nhất một lần. Khung này cho biết: số khóa Tự động, chuông Moodle gần nhất, lần dò thay đổi gần nhất."*

### M6 ★ Thời gian thực: giảng viên điểm danh → chuông cố vấn (8:00 → 10:30)

[Đặt Firefox (Moodle) và Edge (cố vấn GV001, trang **Cảnh báo sớm**) cạnh nhau.]

*"Đây là phần chính. Bên trái là giảng viên trên Moodle, bên phải là cố vấn trên EWARS. Em đóng vai giảng viên điểm danh buổi học gần nhất."*

[Firefox: hoạt động **Điểm danh** → danh sách buổi → buổi **gần nhất đã điểm danh** → biểu tượng **Take attendance** (điểm danh lại) → dòng **KTPM2411906** chọn **A** → **Save attendance**. Nhìn đồng hồ, nói to giờ hiện tại.]

*"Em vừa điểm danh sinh viên 906 **vắng không phép** buổi này. Bây giờ là [giờ]. Trong lúc chờ, em giải thích chuyện gì đang xảy ra:"*

[Nói trong lúc chờ — chỉ vào sơ đồ slide 6 nếu cần:]
- *"Moodle vừa ghi sự kiện 'đã điểm danh'. Plugin xếp một tác vụ gửi chuông — không gửi ngay lúc giảng viên bấm để Moodle không bị chậm."*
- *"Tác vụ nền của Moodle chạy mỗi phút, sẽ gửi chuông có ký HMAC sang EWARS."*
- *"EWARS gom các chuông trong 30 giây, rồi tự đọc lại điểm danh của khóa này qua cửa chỉ đọc."*
- *"Chỉ file điểm danh Mạng máy tính thay đổi — các file khác giống lần trước nên bỏ qua."*
- *"Đợt nhập mới 0 lỗi nên hệ thống tự xác nhận dưới tên 'Đồng bộ Moodle (hệ thống)', nhập, rồi chạy 12 luật."*

[Chuông Edge có số mới / toast "Moodle: Điểm danh — Mạng máy tính vừa cập nhật" hiện ra → bấm **Tải lại** trên toast.]

*"Đây rồi — sau khoảng [n] giây. Chuông báo: **Moodle: Điểm danh — Mạng máy tính vừa cập nhật · Lớp KTPM2411: 1 mở lại**."*

[Mở cảnh báo **KTPM2411906** — trạng thái **Mở lại**, mức **Cao**.]

*"Sinh viên 906 giờ vắng 8 tiết có phép cộng 4 tiết không phép — **12 trên 60, đúng 20%**. Đúng 20% là mức **Cao**, chưa phải Rất cao, vì quy chế nói **vượt quá** 20% mới cấm thi — hệ thống so sánh bằng số nguyên nên không sai do làm tròn."*

*"Và vì cảnh báo **đã giải quyết** mà sinh viên **xấu hơn**, nó **tự mở lại**, cố vấn nhận thông báo."* [Tab MailHog.] *"Đây là email gửi cho cố vấn — nội dung không có số liệu thô."*

> Nếu sau **2 phút** chưa thấy chuông: nói câu cứu nguy ở Phần 5 và chạy lệnh dự phòng.

### M7 — Lưới an toàn và các chế độ (10:30 → 11:30)

[Chrome — Admin → Kết nối Moodle, chỉ danh sách "Các lần đồng bộ".]

*"Mỗi lần đồng bộ ghi rõ nguồn: Admin bấm, sự kiện Moodle, dò thay đổi định kỳ, đồng bộ đêm, hay hết hạn nộp. Đợt nhập nào lỗi quá 10% sẽ hiện **'Cần Admin xem'** và không tự nhập."*

*"Hai trường hợp Moodle **không phát sự kiện**: hết hạn nộp mà sinh viên không nộp — EWARS đã hẹn giờ chạy lại đúng hạn cộng 5 phút; và điểm danh bằng app điện thoại — lịch dò 10 phút sẽ bắt được."*

*"Nếu sinh viên rời khóa trên Moodle, EWARS **không tự xóa** dữ liệu mà liệt kê ở đây để quản trị viên đánh dấu rút học phần — xóa dữ liệu tự động là việc em cố ý không làm."*

[**Nhập dữ liệu** → Lịch sử nhập, chỉ nhãn **Moodle** + người thực hiện "Đồng bộ Moodle (hệ thống)".]

*"Đợt nhập từ Moodle hiện ở lịch sử nhập như đợt nhập file, có nhãn Moodle, lưu file gốc để đối chiếu. Đợt nhập Moodle **không hoàn tác** — Moodle là nguồn gốc, sai thì sửa trên Moodle, lần đồng bộ sau tự sửa theo."*

### M8 — Học lực: kết quả học phần vẫn nhập file + chốt học kỳ (11:30 → 13:30)

*"Kết quả học phần là điểm chính thức, không có trong Moodle, nên em dùng bộ dữ liệu nhập file của học kỳ trước — năm lớp, một trăm sinh viên — đã nhập sẵn để tiết kiệm thời gian."*

[**Nhập dữ liệu** → chỉ Lịch sử: 7 đợt nhập file (kết quả HK3, điểm danh, trắc nghiệm, thực hành, kết quả cuối kỳ).]

[**Học kỳ** → **Học kỳ 1, 2025–2026** → **Chốt học kỳ** → điền mốc **2025-12-31** → **Chạy đánh giá cuối và chốt**.]

*"Cuối học kỳ, quản trị viên chốt. Trước khi chốt, hệ thống liệt kê **hai sinh viên còn thiếu kết quả** để biết trước. Lần chạy cuối mới xét các luật học kỳ."*

[Chờ chạy xong. **Cảnh báo sớm** → học kỳ 1, 2025–2026 → mở **HTTT2411908**.]

*"Sinh viên này điểm trung bình 0,75, rớt 62,5% tín chỉ — chạm ngưỡng quy chế; học kỳ trước cũng chạm. **Hai học kỳ liên tiếp** nên mức Rất cao, kèm ghi chú quy chế — **tham khảo**."*

[Mở **KTPM2411918**.] *"Ở trường mình điểm A quy đổi **3,8** chứ không phải 4,0. Sinh viên này điểm trung bình 1,93 nên bị cảnh báo; nếu tính A bằng 4 thì là 2,0 và không bị. Em đã đối chiếu Quy chế 336."*

(Không đọc tổng số cảnh báo ở bước này — đã bỏ hai lần chạy giữa kỳ của bản cũ nên tổng khác bản cũ.)

### M9 — Nhật ký và kết demo (13:30 → 14:00)

[**Nhật ký hệ thống** → lọc hành động "Đồng bộ Moodle tự động".]

*"Mọi lần đồng bộ, đổi chế độ, xác nhận nhập, xem hồ sơ sinh viên đều ghi nhật ký, không sửa không xóa được — kể cả việc do hệ thống tự làm."*

*"Phần demo của em đến đây là hết. Em xin quay lại slide cuối."*

### Nếu đang trễ giờ — bỏ theo thứ tự này

1. M2: bỏ mở màn xem trước đợt nhập điểm danh (chỉ nói "tổng số tiết quy đổi ra 60").
2. M7: chỉ nói 1 câu: *"Hết hạn nộp và điểm danh bằng app có lịch chạy riêng, đợt nhập nhiều lỗi dừng chờ quản trị viên."*
3. M8: bỏ KTPM2411918, chỉ giữ HTTT2411908.
4. M5: bỏ phần sinh viên xem.
5. **Không bỏ** M6 (thời gian thực + tự mở lại) — đây là phần khác biệt nhất.

---

## Slide 16 — Giới hạn, hướng phát triển, kết luận (1:20)

*"Em xin nói thẳng các giới hạn."*

*"Một: em **chưa kết nối Moodle thật của trường** — cần phòng CNTT và phòng Đào tạo đồng ý cấp token và cài plugin. Moodle demo em tự dựng bằng mã nguồn chính thức, cùng phiên bản."*

*"Hai: 'thời gian thực' là **khoảng một phút**, phụ thuộc tác vụ nền của Moodle; điểm danh bằng app điện thoại không có sự kiện nên chậm tới 10 phút."*

*"Ba: mã lớp học phần, mã học phần em tự đặt theo quy ước, **chưa xác minh** với phòng Đào tạo; quản trị viên sửa được."*

*"Bốn: các **ngưỡng báo sớm và trọng số chưa hiệu chỉnh** bằng dữ liệu thật."*

*"Hướng phát triển: kết nối hệ thống quản lý đào tạo để lấy điểm tự động như Moodle; đẩy thông báo tức thì lên trình duyệt thay vì tải lại 15 giây; dùng dữ liệu nhiều học kỳ để hiệu chỉnh ngưỡng."*

*"Tóm lại, em đã xây dựng hệ thống **phát hiện sớm** sinh viên có nguy cơ, lấy dữ liệu **trực tiếp từ Moodle trong khoảng một phút**, với **12 luật cấu hình được**, **xử lý trung thực việc thiếu dữ liệu**, và **giữ con người ở vị trí quyết định**."*

*"Em xin cảm ơn quý thầy cô đã lắng nghe, rất mong nhận được câu hỏi và góp ý của hội đồng."*

[Cúi chào nhẹ. Đứng yên, nhìn hội đồng.]

---

## Phần 4 — Trả lời câu hỏi của hội đồng

**Công thức 3 bước:** *Trả lời thẳng 1 câu → Giải thích 1–2 câu → Chỉ bằng chứng (màn hình / tài liệu).* Không quá 1 phút mỗi câu.

### 4.1 Câu hỏi về Moodle và thời gian thực

**H: Sao không đọc thẳng cơ sở dữ liệu Moodle cho nhanh?**
*"Dạ, đọc thẳng phải mở cổng cơ sở dữ liệu của trường — vi phạm bảo mật — và vỡ mỗi lần Moodle nâng cấp. Web service là cách chính thức, có phân quyền, chỉ đọc."*

**H: Gọi là thời gian thực mà phải chờ một phút?**
*"Dạ, em gọi là gần thời gian thực. Một phút đến từ tác vụ nền của Moodle chạy mỗi phút, và em cố ý gom 30 giây để nhiều sự kiện liên tiếp chỉ thành một lần đánh giá. Với cảnh báo học tập, một phút là đủ — quan trọng là không phải chờ đến cuối tuần hay cuối kỳ."*

**H: Muốn tức thì thì làm sao?**
*"Dạ, phía Moodle có thể gửi ngay trong lúc giảng viên bấm thay vì qua tác vụ nền, nhưng sẽ làm Moodle chậm và mất cơ chế tự thử lại. Phía trình duyệt có thể đẩy thông báo qua kết nối giữ mở thay vì tải lại 15 giây — em ghi ở hướng phát triển."*

**H: EWARS có ghi gì vào Moodle không? Token bị lộ thì sao?**
*"Dạ không. Dịch vụ phía Moodle chỉ chứa 11 hàm loại đọc — script cài đặt từ chối mọi hàm khác. Token lộ thì người ta chỉ đọc được, và quản trị Moodle thu hồi token bằng một lệnh, em có tùy chọn tạo token mới."*

**H: Ai đó giả chuông gửi vào EWARS thì sao?**
*"Dạ, chuông phải có chữ ký bằng khóa bí mật; sai chữ ký hoặc lệch giờ quá 5 phút bị từ chối. Mà kể cả chuông thật, EWARS cũng không tin nội dung — chỉ coi là tín hiệu để tự đọc lại Moodle. Chuông giả nhiều nhất làm EWARS đọc Moodle thêm một lần."*

**H: Moodle hoặc EWARS tắt giữa chừng thì sao?**
*"Dạ, plugin dùng tác vụ nền nên Moodle tự gửi lại khi EWARS sống lại. Phía EWARS có ba lưới: dò thay đổi mỗi 10 phút, đồng bộ đầy đủ mỗi đêm, và tự gỡ các đợt nhập bị kẹt. Em đã thử tắt máy chủ giữa chừng — phần bị lỡ được gom lại tự động, có test cho từng trường hợp."*

**H: Dữ liệu Moodle sai thì sao, có hoàn tác không?**
*"Dạ, đợt nhập Moodle không hoàn tác vì Moodle là nguồn gốc: giảng viên sửa trên Moodle, lần đồng bộ sau tự sửa theo. Kể cả sửa đi sửa lại về như cũ, hệ thống vẫn nhập đúng — em đã gặp và sửa lỗi này."*

**H: Một khóa Moodle có nhiều lớp học phần, hay sinh viên khoa khác thì sao?**
*"Dạ, bản này mỗi khóa Moodle là một lớp học phần — đây là giới hạn em ghi rõ. Sinh viên Moodle chưa có trong EWARS thì bỏ qua và đếm riêng, không tính là lỗi."*

**H: Vì sao kết quả học phần không lấy từ Moodle?**
*"Dạ, sổ điểm Moodle là điểm thành phần giảng viên nhập, không phải điểm chính thức đã khóa ở phòng Đào tạo. Luật học lực theo quy chế phải dùng điểm chính thức, nên vẫn nhập file."*

### 4.2 Câu hỏi về ý tưởng, nghiệp vụ

**H: Hệ thống này khác gì lọc bằng Excel?**
*"Dạ, Excel lọc một nguồn tại một thời điểm. Hệ thống của em lấy dữ liệu tự động từ Moodle, kết hợp bốn nguồn, theo dõi qua nhiều lần đánh giá — biết sinh viên đang xấu đi hay tốt lên, tự mở lại cảnh báo khi xấu hơn, và ghi lại cố vấn đã hỗ trợ gì."*

**H: Sao không dùng học máy (AI)?**
*"Dạ, trường chưa có dữ liệu lịch sử có nhãn để huấn luyện; cảnh báo phải giải thích được — 'vắng 21,7%' chứ không phải 'mô hình nói 0,8'; và luật bám quy chế, nhà trường kiểm soát được. Khi có dữ liệu nhiều học kỳ, học máy là hướng phát triển hợp lý."*

**H: Ngưỡng 10%, 15% lấy ở đâu? Trọng số 0,4/0,3/0,3?**
*"Dạ, 20% là quy chế; 10% và 15% em đề xuất — khoảng một nửa và ba phần tư ngưỡng cấm thi — chưa hiệu chỉnh bằng dữ liệu thật, quản trị viên đổi được và có chạy thử. Trọng số: điểm danh nặng nhất vì có hậu quả cứng theo quy chế; điểm ưu tiên chỉ để sắp xếp, không tạo cảnh báo."*

**H: Hệ thống báo sai thì sao?**
*"Dạ, cố vấn có trạng thái 'Bỏ qua (báo sai)' kèm lý do; mọi cảnh báo là tham khảo, không đổi học vụ."*

**H: Chuông có làm phiền cố vấn không?**
*"Dạ, mỗi lần đánh giá chỉ một thông báo cho mỗi người, và cố vấn chỉ nhận khi lớp mình có sinh viên học các môn vừa cập nhật hoặc có cảnh báo thay đổi. Giảm mức thì không gửi email. Cảnh báo mức thấp chỉ báo trong ứng dụng."*

**H: Sao sinh viên phải chờ cố vấn xác nhận mới thấy cảnh báo?**
*"Dạ, để sinh viên nhận cảnh báo cùng sự hỗ trợ của cố vấn, tránh hoang mang vì một nhãn tự động có thể sai."*

### 4.3 Câu hỏi cần mở màn hình

Học kỳ Moodle = **Học kỳ 1, 2026–2027** (lớp KTPM2411). Bộ nhập file = **Học kỳ 1, 2025–2026**.

| Hội đồng hỏi | Mở đâu | Mã luật |
|---|---|---|
| Vắng vượt 20%? | Moodle: GV001 → KTPM2411903 (MMT 16/60 = 26,7%) | ATT-01 |
| Vắng đúng 20%? | Sau M6: KTPM2411906 (12/60) → Cao | ATT-01 |
| Vắng tăng nhanh? | Moodle: KTPM2411904 (HĐH, 0 → 8 tiết trong 14 ngày) | ATT-02 |
| Bỏ bài, điểm thấp? | KTPM2411905 (bỏ 2 bài HĐH), 917 (làm dở quá hạn), 911 (4/10, 3/10) | LMS-01, LMS-02 |
| Không nộp, nộp trễ, gia hạn? | 907 (không nộp 2 bài), 909 (trễ 2 bài — mức Thấp, không email), 915 (được gia hạn → chưa báo) | LMS-03, LMS-04 |
| Nhiều nguồn cùng xấu? | KTPM2411913 (HĐH: vắng + không nộp) → Rất cao | COMB-01 |
| Học lại? | Học kỳ 2025–2026: GV003 → HTTT2411903, 904 | COMB-02 |
| Rớt môn, tín chỉ, ĐTB, sa sút? | Sau M8: KTPM2411913/914, 915, 918; HTTT2411906–908 | ACA-01…04 |
| Sinh viên chuyển đến / thiếu dữ liệu? | Học kỳ 2025–2026: GV005 → KHDL2411919 "Chưa đủ" | — |
| Phân quyền? | GV002 dán `/advisor/students/KTPM2411903` → bị chặn | — |
| Nhập file có lỗi? | `docs/demo-data/minh-hoa-loi/` (làm trên học kỳ chưa chốt) | — |
| Hết hạn nộp tự đánh giá? | Kịch bản phụ ở `docs/demo-script.md` (cần chờ 5–8 phút) | LMS-01, LMS-03 |
| Hiệu năng, sao lưu, bảo mật? | `docs/bao-cao/02-hieu-nang.md`, `03-sao-luu-khoi-phuc.md`, `01-ra-soat-bao-mat.md` | — |

### 4.4 Câu hỏi kỹ thuật

**H: Làm sao test Moodle mà không cần Moodle chạy?**
*"Dạ, em gọi đủ 11 hàm trên Moodle thật một lần và lưu phản hồi làm dữ liệu mẫu; test dùng một máy chủ Moodle giả đọc dữ liệu đó. Nên test chạy được trong CI, không cần mạng."*

**H: Làm sao biết luật chạy đúng? "Không dùng dữ liệu tương lai" là sao?**
*"Dạ, mỗi luật có test riêng; ngoài ra có test nghiệm thu so khớp đúng từng dấu hiệu với bảng tính tay trước. Chạy với mốc ngày nào thì chỉ dùng dữ liệu có ngày đến mốc đó — có test thêm dữ liệu sau mốc thì kết quả không đổi."*

**H: Chạy hai lần có trùng cảnh báo / trùng thông báo không?**
*"Dạ không. Mỗi sinh viên mỗi học kỳ chỉ một cảnh báo đang mở, khóa ở cơ sở dữ liệu; mỗi lần đánh giá mỗi người chỉ một thông báo, cũng khóa ở cơ sở dữ liệu. Moodle gửi trùng chuông thì bị bỏ qua nhờ mã riêng."*

**H: Dữ liệu lớn thì sao?**
*"Dạ, với 5.000 sinh viên chạy cả học kỳ khoảng 27 giây, màn hình dưới 0,1 giây. Với Moodle, lịch dò 10 phút chỉ gọi khoảng 9 hàm nhẹ mỗi khóa; hàm nặng — đọc lượt làm bài từng sinh viên — chỉ gọi khi khóa có thay đổi."*

**H: Sao chọn Next.js mà không tách backend riêng?**
*"Dạ, một khung cho cả giao diện và máy chủ giúp một người quản lý gọn; việc nặng em vẫn tách ra worker chạy container riêng."*

### 4.5 Khi không biết câu trả lời

- *"Dạ, câu hỏi này em chưa tìm hiểu tới. Em xin ghi nhận và bổ sung vào hướng phát triển."*
- *"Dạ, theo em hiểu câu hỏi của thầy/cô là [nhắc lại]… có đúng không ạ?"*
- **Không bịa số.** *"Con số chính xác em ghi trong báo cáo kiểm thử, em xin phép mở ra."*

---

## Phần 5 — Câu cứu nguy khi demo trục trặc

| Sự cố | Nói gì | Làm gì |
|---|---|---|
| M6: quá 2 phút chưa có chuông | *"Tác vụ nền của Moodle chạy mỗi phút, đôi khi lệch một nhịp; trong lúc chờ em cho thầy cô xem trang Kết nối…"* | Admin → Kết nối Moodle → **Đồng bộ ngay** (khóa Tự động nhập luôn) → chuông sau ~15 giây |
| M6: không đăng nhập / không thao tác được Moodle | *"Em dùng lệnh mô phỏng đi đúng đường của Moodle."* | Terminal: `docker compose exec -u www-data moodle php /var/www/html/ewars-cli/ewars_simulate.php --course=010100089201 --absent=KTPM2411906` (Git Bash: thêm `MSYS_NO_PATHCONV=1` ở đầu) |
| Chuông Moodle báo lỗi / trang Kết nối "Không kết nối được" | *"Kết nối Moodle đang gián đoạn — đây là lý do có chế độ Thủ công và lịch dò dự phòng."* | `docker compose --profile moodle up -d moodle` rồi tải lại; vẫn lỗi → mở video |
| Trang tải lâu | *"Hệ thống đang xử lý, trong lúc chờ em xin giải thích…"* | Chờ tối đa 15 giây |
| Lỗi / trắng trang | *"Dạ, máy demo đang gặp sự cố, em xin phép chuyển sang video quay sẵn từ đúng dữ liệu này."* | Mở video, nói theo Phần 3 |
| Bấm nhầm, kích hoạt luật | *"Em vừa kích hoạt nhầm; số liệu phía sau sẽ khác một chút."* | Đi tiếp |
| Quên bước tiếp theo | *"Tiếp theo em xin trình bày phần…"* | Nhìn bản in Phần 6 |

---

## Phần 6 — Tờ ghi nhớ 1 trang (in ra, để trên bàn)

- **Câu một dòng:** Moodle → chuông báo (ký HMAC) → EWARS tự đọc lại (chỉ đọc) → tự nhập → 12 luật → chuông cố vấn · chỉ tham khảo.
- **Số cần nhớ:** Moodle: 2 khóa × 15 buổi × 4 tiết = **60 tiết** · đồng bộ ~480 · **121** · **120** dòng · **12 dấu hiệu, 9 cảnh báo** · 903 = 16/60 (**26,7%**, Rất cao) · 906: 8 → 12/60 = **20%** (Cao, mở lại) · đo **34 giây** · hạn nộp + **5 phút** · dò **10 phút** · tự nhập khi lỗi ≤ **10%** · **472** test · 11 hàm chỉ đọc · 1 tiết = **50 phút** · A = **3,8**.
- **Thứ tự demo:** Moodle (khóa MMT, điểm danh) → Kết nối Moodle: bật 2 khóa → Đồng bộ ngay → 3 đợt nhập → Xác nhận → Chạy đánh giá (12/9) → chuông Admin → GV001: 903 xác nhận + can thiệp; 906 giải quyết → SV 903 → Bật Tự động → ★ Moodle điểm danh 906 vắng → chuông "1 mở lại" → 906 Cao 20% + MailHog → lưới an toàn → chốt HK 2025–2026 (mốc 2025-12-31) → HTTT 908, KTPM 918 → Nhật ký.
- **Ba điều phải nói bằng được:** (1) EWARS chỉ đọc Moodle, không tự quyết học vụ; (2) gần thời gian thực ~1 phút + lưới an toàn cho việc không có sự kiện; (3) đã giải quyết mà xấu hơn thì tự mở lại và báo ngay.
