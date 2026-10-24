# Kịch bản thuyết trình bảo vệ đồ án — CTUT-EWARS

> Tài liệu này để **đọc thành tiếng và tập nói**. Mỗi đoạn in nghiêng-thường là lời nói nguyên văn; chữ trong ngoặc vuông `[ ]` là việc làm (chuyển slide, bấm, dừng), không đọc ra.
> Tổng thời lượng: **thuyết trình ~12 phút + demo ~10 phút + hỏi đáp**. Số liệu khớp `docs/demo-data/KET_QUA_MONG_DOI.md` (đã kiểm bằng test tự động) — đừng tự đổi số.

---

## Phần 0 — Đọc trước khi tập (5 phút)

### 0.1 Bảy mẹo cho người chưa quen thuyết trình

1. **Không học thuộc từng chữ.** Học thuộc **câu mở đầu và câu kết** của mỗi phần. Ở giữa, nhìn 3 từ khóa in đậm là đủ nói tiếp.
2. **Nói chậm hơn bạn nghĩ.** Hồi hộp làm nói nhanh. Mỗi khi chuyển slide: hít 1 hơi, đếm thầm "một, hai", rồi mới nói.
3. **Một câu = một ý.** Câu dài thì dễ lạc. Kịch bản này đã cắt câu ngắn sẵn.
4. **Nhìn hội đồng ở đầu và cuối mỗi câu,** nhìn màn hình ở giữa câu. Không quay lưng đọc slide.
5. **Quên lời thì đọc tiêu đề slide** rồi nói "Ý chính ở đây là…" — người nghe không biết bạn quên.
6. **Câu hỏi khó thì được phép dừng 3 giây.** Nói: *"Dạ, em xin phép suy nghĩ một chút."* Im lặng 3 giây không sao; trả lời sai mới mất điểm.
7. **Tập 3 lần:** lần 1 đọc to theo giấy; lần 2 chỉ nhìn từ khóa, bấm giờ; lần 3 nói trước 1 người bạn và nhờ họ hỏi bất kỳ câu nào trong Phần 4.

### 0.2 Hệ thống trong 1 câu (thuộc lòng câu này)

> *"CTUT-EWARS gom dữ liệu điểm danh, bài làm trên LMS và kết quả học phần, dùng 12 luật nghiệp vụ để phát hiện sớm sinh viên có dấu hiệu rủi ro, rồi gửi cảnh báo cho cố vấn học tập xử lý — hệ thống chỉ cảnh báo tham khảo, không bao giờ tự quyết định học vụ."*

Nếu bị hỏi bất ngờ "tóm lại hệ thống làm gì?", đọc đúng câu này.

### 0.3 Từ khó → cách nói dễ hiểu

| Thuật ngữ | Khi nói, dùng câu này |
|---|---|
| Rule engine | "bộ máy chạy luật" — đọc dữ liệu, so với ngưỡng, ra dấu hiệu |
| Dấu hiệu (trigger) | "một lần một luật đúng với một sinh viên" |
| Cảnh báo (alert) | "hồ sơ mà cố vấn thấy — gom mọi dấu hiệu của 1 sinh viên trong 1 học kỳ" |
| RiskScore / điểm rủi ro | "con số từ 0 đến 1 để sắp xếp ai cần xem trước — không tạo cảnh báo" |
| asOf / mốc dữ liệu | "ngày ta giả sử đang đứng — chỉ dùng dữ liệu đến ngày đó" |
| Chống rò rỉ thời gian | "không dùng dữ liệu tương lai để đánh giá quá khứ" |
| STALE | "dữ liệu đã cũ quá 14 ngày" |
| Phiên bản luật | "đổi ngưỡng là tạo bản mới, bản cũ vẫn giữ để đối chiếu" |
| Worker / hàng đợi | "phần chạy ngầm, xử lý việc nặng để giao diện không bị treo" |
| Phân quyền theo phạm vi | "cố vấn chỉ thấy sinh viên lớp mình, kiểm ở máy chủ chứ không chỉ ẩn nút" |

---

## Phần 1 — Gợi ý dàn slide (14 slide)

| # | Tiêu đề slide | Nội dung trên slide (ít chữ) | Thời gian |
|---|---|---|---|
| 1 | Tên đề tài | Tên, sinh viên, GVHD | 0:20 |
| 2 | Vấn đề | 3 gạch: phát hiện muộn · dữ liệu rời rạc · cố vấn quá tải | 1:00 |
| 3 | Mục tiêu và ranh giới | 4 việc hệ thống làm · 1 việc KHÔNG làm | 1:00 |
| 4 | Người dùng | 3 vai trò: Sinh viên · Cố vấn học tập · Quản trị | 0:45 |
| 5 | Dữ liệu đầu vào | 4 nguồn + file CSV/Excel, nhập 2 bước | 1:00 |
| 6 | 12 luật | Bảng 4 nhóm: Điểm danh · LMS · Học lực · Kết hợp | 1:30 |
| 7 | Từ dấu hiệu đến cảnh báo | Sơ đồ: dữ liệu → luật → dấu hiệu → cảnh báo → cố vấn → sinh viên | 1:00 |
| 8 | Điểm rủi ro và thiếu dữ liệu | Trọng số 0,4 / 0,3 / 0,3 · Đủ / Một phần / Chưa đủ | 1:00 |
| 9 | Kiến trúc | Next.js · PostgreSQL · Worker + Redis · MinIO · Docker | 1:00 |
| 10 | Bảo mật và pháp lý | Phân quyền theo lớp · Nhật ký · Luật 91/2025 | 0:45 |
| 11 | Kiểm thử | >400 test · nghiệm thu khớp 100% · đo 5.000 SV | 0:45 |
| 12 | Dữ liệu demo | 5 lớp × 20 SV, mỗi lớp 1 chủ đề | 0:30 |
| 13 | (Demo trực tiếp) | — | 10:00 |
| 14 | Giới hạn · Hướng phát triển · Kết luận | 3 + 3 gạch | 1:30 |

---

## Phần 2 — Lời nói theo từng slide (~12 phút)

### Slide 1 — Mở đầu (0:20)

*"Em kính chào quý thầy cô trong hội đồng. Em tên là [họ tên], sinh viên lớp [lớp]. Hôm nay em xin trình bày đồ án: **Hệ thống cảnh báo sớm rủi ro học tập dựa trên luật nghiệp vụ**, tên viết tắt là CTUT-EWARS. Giảng viên hướng dẫn là [thầy/cô …]."*

*"Phần trình bày của em gồm ba phần: vấn đề và giải pháp, sau đó là demo trực tiếp khoảng mười phút, cuối cùng là giới hạn và hướng phát triển."*

[Dừng 2 giây. Chuyển slide.]

### Slide 2 — Vấn đề (1:00)

*"Thưa hội đồng, hiện nay một sinh viên thường chỉ bị phát hiện là gặp khó khăn **khi đã quá muộn** — tức là khi đã bị cấm thi, đã rớt môn, hoặc đã bị cảnh báo học tập theo quy chế."*

*"Thật ra các dấu hiệu đã có từ sớm: vắng học tăng dần, không làm bài trắc nghiệm, không nộp bài thực hành. Nhưng **dữ liệu này nằm rời rạc** — điểm danh một nơi, LMS một nơi, điểm một nơi."*

*"Còn cố vấn học tập thì phụ trách cả lớp, **không có thời gian** mở từng hệ thống để soi từng sinh viên."*

*"Vì vậy em đặt câu hỏi: làm sao để **gom dữ liệu về một chỗ** và **tự động chỉ ra** sinh viên nào cần được quan tâm trước?"*

### Slide 3 — Mục tiêu và ranh giới (1:00)

*"Hệ thống của em làm đúng bốn việc: một, phát hiện dấu hiệu; hai, tạo cảnh báo sớm; ba, gửi cảnh báo cho cố vấn học tập; bốn, cho cố vấn xác nhận và ghi lại việc đã hỗ trợ sinh viên."*

*"Và có **một việc hệ thống không bao giờ làm**: tự sửa tình trạng học vụ chính thức của sinh viên. Mọi cảnh báo đều được đánh dấu là **tham khảo**. Quyết định vẫn thuộc về con người và quy chế của trường."*

*"Em chọn ranh giới này vì một lý do đơn giản: luật do con người đặt ra có thể sai, dữ liệu có thể thiếu. Nếu hệ thống tự quyết, một lỗi dữ liệu có thể ảnh hưởng đến học vụ của sinh viên thật."*

### Slide 4 — Người dùng (0:45)

*"Hệ thống có ba vai trò."*

*"**Sinh viên** đăng nhập bằng Google với email của trường, và chỉ vào được khi nhà trường đã nhập hồ sơ. Sinh viên chỉ xem được dữ liệu của chính mình."*

*"**Cố vấn học tập** tự đăng ký, quản trị viên duyệt. Cố vấn chỉ thấy sinh viên của lớp mình phụ trách."*

*"**Quản trị viên** nhập dữ liệu, cấu hình luật, chạy đánh giá. Quản trị viên xem được mọi cảnh báo nhưng **chỉ đọc** — không xử lý thay cố vấn."*

### Slide 5 — Dữ liệu đầu vào (1:00)

*"Dữ liệu vào bằng file CSV hoặc Excel, gồm danh sách sinh viên và bốn nguồn học tập: **điểm danh theo tiết**, **bài trắc nghiệm** trên LMS, **bài thực hành** trên LMS, và **kết quả học phần** đã khóa điểm."*

*"Em thiết kế mẫu file theo đúng các cột trong hệ thống của trường. Mỗi lần nhập đi qua **hai bước**: bước một hệ thống đọc và cho xem trước — dòng nào lỗi, lỗi gì; bước hai người dùng mới bấm xác nhận nạp."*

*"Một vài điều em chủ động làm cho an toàn: ngày tháng không rõ định dạng thì **từ chối chứ không đoán**; nạp nhầm thì **hoàn tác được** có điều kiện; file gốc được lưu lại để đối chiếu."*

### Slide 6 — 12 luật (1:30)

*"Đây là phần lõi của hệ thống: mười hai luật, chia bốn nhóm."*

[Chỉ vào từng nhóm trên slide.]

*"Nhóm **điểm danh** có hai luật. ATT-01: vắng từ 10% là mức trung bình, 15% là cao, **vượt 20% là rất cao** — vì quy chế quy định vắng quá 20% bị cấm thi. ATT-02: số tiết vắng không phép **tăng nhanh** giữa hai lần chốt."*

*"Nhóm **LMS** có bốn luật: bỏ bài trắc nghiệm, điểm trắc nghiệm thấp dưới 50%, không nộp bài thực hành, và nộp trễ nhiều lần."*

*"Nhóm **học lực** có bốn luật: rớt học phần; tỷ lệ tín chỉ rớt cao; điểm trung bình học kỳ thấp; và **sa sút so với học kỳ trước**."*

*"Nhóm **kết hợp** có hai luật: COMB-01 khi **hai nguồn trở lên cùng xấu** trong một học phần; COMB-02 khi sinh viên **học lại** mà vẫn có dấu hiệu sa sút — mức cảnh báo được nâng thêm một bậc."*

*"Em xin nói rõ: các ngưỡng có hai loại. Ngưỡng **theo quy chế** — như 20% vắng, điểm trung bình dưới 1,0 — lấy từ Quy chế 336 của trường. Ngưỡng **báo sớm** — như 10%, 15% — là em đề xuất, **chưa được hiệu chỉnh bằng dữ liệu thật**. Cả hai loại quản trị viên đều đổi được trên giao diện, không phải sửa code."*

### Slide 7 — Từ dấu hiệu đến cảnh báo (1:00)

*"Khi chạy đánh giá, mỗi lần một luật đúng với một sinh viên, hệ thống ghi một **dấu hiệu** kèm bằng chứng."*

*"Nhưng cố vấn không nhìn thấy từng dấu hiệu rời rạc. Hệ thống **gom tất cả dấu hiệu** của một sinh viên trong một học kỳ thành **một cảnh báo duy nhất**. Mức của cảnh báo là mức **cao nhất** trong các dấu hiệu."*

*"Cảnh báo có vòng đời: mới mở, cố vấn xác nhận, đang xử lý, đã giải quyết. Nếu đã giải quyết mà sau đó sinh viên **xấu hơn**, cảnh báo **tự mở lại** và báo cho cố vấn."*

*"Về thông báo: cảnh báo mới hoặc tăng mức thì báo; **giảm mức thì không báo** để cố vấn không bị làm phiền. Mức thấp chỉ báo trong ứng dụng, từ mức trung bình trở lên thì gửi thêm email."*

*"Còn sinh viên chỉ thấy cảnh báo **sau khi cố vấn đã xác nhận** — để sinh viên nhận được thông tin kèm sự hỗ trợ, chứ không phải một cái nhãn lạnh lùng."*

### Slide 8 — Điểm rủi ro và thiếu dữ liệu (1:00)

*"Ngoài cảnh báo, mỗi sinh viên có một **điểm rủi ro từ 0 đến 1**, gộp ba nhóm: điểm danh trọng số 0,4, LMS 0,3, học lực 0,3. Điểm danh nặng nhất vì đây là nguồn duy nhất có hậu quả cứng theo quy chế và có số liệu hằng tuần."*

*"Điểm này **chỉ để sắp xếp** ai cần xem trước, nó **không tạo ra cảnh báo**."*

*"Điều em muốn nhấn mạnh là xử lý **thiếu dữ liệu**. Nếu một sinh viên không có dữ liệu, hệ thống **không được** hiểu là 'rủi ro thấp'. Em chia ba mức: **Đủ**, **Một phần** — khi thiếu một hoặc hai nhóm, và **Chưa đủ dữ liệu** — khi không có nhóm nào, lúc đó điểm rủi ro để trống."*

### Slide 9 — Kiến trúc (1:00)

*"Về kỹ thuật, em dùng **Next.js** làm cả giao diện lẫn máy chủ, cơ sở dữ liệu **PostgreSQL**."*

*"Những việc nặng như đọc file lớn hay chạy luật cho cả nghìn sinh viên được đẩy vào **hàng đợi** và một tiến trình chạy ngầm riêng gọi là **worker**, để giao diện không bị treo."*

*"File gốc lưu ở **MinIO**, email gửi qua máy chủ thư nội bộ. Toàn bộ chạy trong **Docker**, nên dựng lại trên máy khác chỉ bằng vài lệnh."*

*"Bộ máy chạy luật em **tự viết**: mỗi luật là một file riêng, là hàm thuần — nhận dữ liệu, trả kết quả — nên kiểm thử được độc lập. Thêm một luật mới chỉ cần thêm một file, không sửa lõi."*

### Slide 10 — Bảo mật và pháp lý (0:45)

*"Dữ liệu sinh viên là dữ liệu cá nhân, nên em áp dụng Luật Bảo vệ dữ liệu cá nhân 91/2025 và Nghị định 356/2025."*

*"Cụ thể: phân quyền được **kiểm ở máy chủ**, cố vấn lớp A không xem được sinh viên lớp B, và có test tự động chứng minh điều này. Mọi thao tác quan trọng — đổi luật, xem hồ sơ, xuất file, nhập dữ liệu — đều ghi **nhật ký không sửa, không xóa được**. File xuất Excel được chống chèn công thức."*

### Slide 11 — Kiểm thử (0:45)

*"Hệ thống có **hơn 400 test tự động** chạy trên cơ sở dữ liệu thật. Mỗi luật có test riêng theo mã luật."*

*"Quan trọng nhất là **test nghiệm thu**: em tính tay kết quả mong đợi cho 100 sinh viên demo **trước khi** viết dữ liệu, sau đó hệ thống phải ra **đúng từng dấu hiệu** — thừa một hay thiếu một đều là lỗi. Kết quả khớp 100%."*

*"Về hiệu năng, em đo trên dữ liệu giả 5.000 sinh viên: chạy đánh giá cả học kỳ khoảng **27 giây**, các màn hình đều dưới **0,1 giây**."*

### Slide 12 — Dữ liệu demo (0:30)

*"Để demo, em dựng toàn bộ Khoa Công nghệ thông tin khóa 2024: **năm lớp, mỗi lớp 20 sinh viên**, mỗi lớp một chủ đề. Lớp Kỹ thuật phần mềm về điểm danh, lớp Công nghệ thông tin về bài LMS, lớp Hệ thống thông tin về học lực và học lại, lớp Khoa học máy tính về nhiều nguồn và vòng đời cảnh báo, lớp Khoa học dữ liệu về thiếu dữ liệu. Họ tên và mã số đều là giả."*

*"Sau đây em xin phép demo trực tiếp."*

[Chuyển sang trình duyệt. Hít một hơi.]

---

## Phần 3 — Lời nói khi demo (~10 phút)

### Chuẩn bị trước giờ bảo vệ (≥ 15 phút trước)

```bash
docker compose --profile dev up -d
```

```bash
npm run demo:reset -- --yes
```

- Ba cửa sổ, **mỗi vai đăng nhập 1 lần** (đăng nhập nhanh giới hạn 10 lần/phút):
  - Chrome thường → Quản trị viên.
  - Trình duyệt thứ hai (Edge) → Cố vấn học tập (đổi GV001 ↔ GV004 trong cửa sổ này).
  - Chrome ẩn danh → Sinh viên `KTPM2411903`.
- Tab MailHog http://localhost:8025.
- Video quay sẵn trọn phần demo trong USB/desktop — **máy trục trặc thì mở video, nói y như dưới**.
- Thứ tự dưới đây KHÔNG đảo được: vòng đời KHMT phải làm **trước** Chạy 2; chốt học kỳ là **bước cuối** (sau chốt không nạp, không chạy lại được).

### D1 — Màn hình đăng nhập (0:00 → 0:30)

[Mở `/login`.]

*"Đây là màn hình đăng nhập. Sinh viên chỉ có nút Google, cán bộ đăng nhập bằng email và mật khẩu. Ở dưới có liên kết chính sách bảo vệ dữ liệu cá nhân. Vì đang ở chế độ demo, em có nút đăng nhập nhanh — chế độ này tắt khi triển khai thật."*

### D2 — Quản trị: Bắt đầu và Nhập dữ liệu (0:30 → 2:15)

[Đăng nhập nhanh Quản trị viên → trang **Bắt đầu**.]

*"Trang Bắt đầu hướng dẫn quản trị viên làm theo đúng thứ tự: thiết lập khoa, lớp, sinh viên; rồi mỗi học kỳ; rồi hằng tuần. Bước nào chưa đủ dữ liệu thì bị khóa."*

[Mở **Nhập dữ liệu** → lô Điểm danh.]

*"Đây là một lần nhập điểm danh gồm 32 file — đúng như trường xuất, mỗi lớp học phần một file. Hệ thống tự nhận ra 16 lớp học phần. Có một cảnh báo ở đây:"* [chỉ] *"tên trong file ghi 'Tuấn', còn hồ sơ là 'Tú' — hệ thống không tự sửa, chỉ nhắc người nhập kiểm tra."*

[Quay lại, chỉ bảng **Học phần nào cần nạp dữ liệu**.]

*"Bảng này cho biết học phần nào đã có dữ liệu, học phần nào chậm."*

[Chọn loại Điểm danh → kéo file trong `docs/demo-data/minh-hoa-loi/`.]

*"Giờ em thử nạp một file có lỗi."* [chờ] *"Hệ thống chỉ ra hai dòng lỗi: một mã sinh viên không tồn tại, một ngày viết kiểu Mỹ. Ngày không rõ thì hệ thống **từ chối chứ không đoán**. Người nhập tải file lỗi về sửa rồi nạp lại. Ở đây em hủy lô này."* [Bấm **Hủy lô**.]

### D3 — Chạy đánh giá mốc 10/10 (2:15 → 3:00)

[**Chạy đánh giá** → học kỳ 1 2025–2026, mốc **2025-10-10** → Chạy.]

*"Bây giờ em chạy đánh giá, giả sử hôm nay là ngày 10 tháng 10. Hệ thống **chỉ dùng dữ liệu đến ngày đó** — kết quả học phần công bố tháng 11 đã nằm trong cơ sở dữ liệu, nhưng **không được dùng**. Đây là cách chống dùng dữ liệu tương lai."*

[Kết quả hiện.]

*"Kết quả: **41 dấu hiệu**, gom lại thành **24 cảnh báo** cho 5 lớp. Mỗi sinh viên một dòng: mức cao nhất, điểm rủi ro, và mức đủ dữ liệu."*

[Bấm **Tất cả sinh viên**, chọn lớp KHDL2411, chỉ dòng KHDL2411919.]

*"Thầy cô xem sinh viên KHDL2411919: bạn này chuyển đến, chưa có tên trong file điểm danh, môn đang học không dùng LMS — hệ thống ghi **Chưa đủ dữ liệu**, điểm rủi ro để trống, **không** coi là rủi ro thấp."*

### D4 — Tổng quan quản trị (3:00 → 3:45)

[**Tổng quan** → lọc Ngành = Kỹ thuật phần mềm (10 cảnh báo), rồi bỏ lọc.]

*"Trang tổng quan cho quản trị viên nhìn toàn khoa: số cảnh báo theo mức, theo nguồn dữ liệu, tiến độ cố vấn xử lý. Lọc được theo khoa, theo ngành — em lọc ngành Kỹ thuật phần mềm thì còn 10 cảnh báo."*

*"Quản trị viên chỉ giám sát, không có nút xử lý cảnh báo."*

### D5 — Cố vấn GV001: xử lý một cảnh báo (3:45 → 5:15)

[Cửa sổ cố vấn → đăng nhập nhanh **GV001** → **Tổng quan** → **Ma trận lớp**.]

*"Đây là cố vấn lớp Kỹ thuật phần mềm. Ma trận này là sinh viên nhân học phần, màu càng đậm càng nặng. Em bấm vào một ô:"* [bấm ô KTPM2411903 · Hệ quản trị CSDL]

*"Sinh viên 903 vắng **13 trên 60 tiết, tức 21,7%** — vượt ngưỡng cấm thi 20%, nên mức **Rất cao**. Thêm nữa, vắng không phép tăng từ 3 lên 11 tiết chỉ trong một tuần — đó là luật vắng tăng nhanh."*

*"Để so sánh, sinh viên 904 vắng **đúng 20%** — chưa vượt — nên chỉ ở mức Cao. Hệ thống so sánh bằng số nguyên nên không bị sai do làm tròn."* (Nói câu này nếu còn thời gian.)

[Bấm **Xác nhận đã xem** → ghi can thiệp → Lưu.]

*"Cố vấn xác nhận và ghi lại đã làm gì: gọi điện, gặp trực tiếp… Nội dung nhạy cảm thì quản trị viên cũng không đọc được."*

### D6 — Sinh viên xem (5:15 → 5:45)

[Cửa sổ ẩn danh → đăng nhập nhanh **Sinh viên KTPM2411903**.]

*"Đây là màn hình của chính sinh viên. Bạn ấy thấy cảnh báo **vì cố vấn vừa xác nhận**. Nếu cố vấn chưa xác nhận, sinh viên không thấy gì. Thanh vắng màu đỏ vì đã vượt vạch ngưỡng. Sinh viên không nhận email — xem trên trang này."*

### D7 — Cố vấn GV004: giải quyết cảnh báo (5:45 → 6:45)

[Cửa sổ cố vấn → đăng nhập nhanh **GV004**.]

*"Giờ em đổi sang cố vấn lớp Khoa học máy tính. Thầy cô để ý: cố vấn này **chỉ thấy 5 cảnh báo của lớp mình**, không thấy sinh viên lớp Kỹ thuật phần mềm vừa rồi. Phân quyền được kiểm ở máy chủ, không chỉ ẩn trên giao diện."*

[Mở **KHMT2411905** → Xác nhận → ghi can thiệp → **Đánh dấu đã giải quyết**.]

*"Sinh viên 905 không nộp một bài thực hành, mức Trung bình. Giả sử cố vấn đã nhắc và coi như đã giải quyết. Bắt buộc phải ghi can thiệp thì mới được đánh dấu giải quyết. Em sẽ quay lại sinh viên này ngay sau đây."*

### D8 — Chạy mốc 20/11: mở lại cảnh báo (6:45 → 7:45)

[Cửa sổ quản trị → **Chạy đánh giá** mốc **2025-11-20**.]

*"Bây giờ em chạy tiếp mốc 20 tháng 11. Lúc này môn Logic học đã khóa điểm."*

[Kết quả: 29 cảnh báo.]

*"Tổng còn **29 cảnh báo**. Có ba điểm đáng chú ý."*

*"Một: ba sinh viên lớp Kỹ thuật phần mềm **rớt môn Logic học** — có bạn rớt vì không được dự thi, có bạn vắng thi — hệ thống ghi rõ lý do."*

*"Hai: điểm danh hai môn kia đã **cũ quá 14 ngày**. Hệ thống **giữ** các dấu hiệu vắng cũ chứ không coi là 'hết vắng' — vì không có dữ liệu mới không có nghĩa là sinh viên đã đi học lại."*

[Cửa sổ cố vấn GV004 → chuông thông báo → KHMT2411905.]

*"Ba — và đây là lý do em vừa giải quyết sinh viên 905: bạn ấy giờ không nộp **hai** bài, nặng hơn mức đã ghi nhận, nên cảnh báo **tự mở lại** và cố vấn nhận thông báo."* [Mở tab MailHog.] *"Đây là email gửi cho cố vấn."*

*"Ngược lại, có sinh viên giảm mức thì hệ thống chỉ cập nhật, **không gửi thông báo** để cố vấn không bị làm phiền."*

### D9 — Cấu hình luật: chạy thử (7:45 → 8:30)

[Quản trị → **Cấu hình luật** → ATT-01 → thêm mức 8% "Thấp" → Lưu bản nháp → Chạy thử mốc 2025-10-10.]

*"Quản trị viên đổi được ngưỡng mà không cần sửa code. Em thử thêm mức vắng 8%. Đổi ngưỡng luôn tạo **phiên bản mới**, và bắt buộc **chạy thử** trước để xem sẽ có thêm những sinh viên nào."*

[Chỉ danh sách thêm/bớt → **Bỏ bản nháp**.]

*"Em bỏ bản nháp để giữ nguyên số liệu demo. Mọi thao tác này đều được ghi nhật ký."*

### D10 — Chốt học kỳ: luật học lực (8:30 → 9:30)

[**Học kỳ** → **Chốt học kỳ** (Học kỳ 1, 2025–2026). Trong hộp thoại điền mốc **2025-12-31** rồi bấm **Chạy đánh giá cuối và chốt**.]

*"Bước cuối là chốt học kỳ. Trước khi chốt, hệ thống liệt kê **hai sinh viên còn thiếu kết quả** để quản trị viên biết. Em xác nhận."*

[Chờ chạy xong: 35 cảnh báo. Mở **Cảnh báo sớm**, lọc ngành Hệ thống thông tin → 6.]

*"Sau lần chạy cuối có **35 cảnh báo**. Bây giờ các luật học kỳ mới được xét."*

[Mở HTTT2411908.]

*"Sinh viên này điểm trung bình học kỳ 0,75, rớt 62,5% tín chỉ — chạm ngưỡng quy chế; và học kỳ trước cũng chạm ngưỡng. **Hai học kỳ liên tiếp**, nên mức Rất cao, kèm ghi chú quy chế: ba lần liên tiếp có thể bị buộc thôi học — **tham khảo**."*

*"Một chi tiết nhỏ: ở trường mình, điểm A quy đổi là **3,8** chứ không phải 4,0. Sinh viên KTPM2411918 có điểm trung bình 1,93 nên bị cảnh báo; nếu tính A bằng 4 thì là đúng 2,0 và sẽ không bị cảnh báo. Em đã đối chiếu theo Quy chế 336."*

### D11 — Nhật ký và kết demo (9:30 → 10:00)

[**Nhật ký hệ thống** → lọc "Xem hồ sơ sinh viên".]

*"Cuối cùng là nhật ký: ai xem hồ sơ nào, ai đổi luật, ai nhập file, lúc nào — đều được ghi và không sửa, không xóa được."*

*"Phần demo của em đến đây là hết. Em xin quay lại slide cuối."*

### Nếu đang trễ giờ — bỏ theo thứ tự này

1. Bỏ câu so sánh sinh viên 904 (D5).
2. Bỏ D9 (cấu hình luật) — chỉ nói một câu: *"Ngưỡng đổi được trên giao diện, có phiên bản và chạy thử."*
3. Bỏ D4 lọc ngành — chỉ nói câu "Chưa đủ dữ liệu".
4. **Không bỏ** D7–D8 (mở lại cảnh báo) và D10 (chốt) — đây là phần khác biệt nhất.

---

## Slide 14 — Giới hạn, hướng phát triển, kết luận (1:30)

*"Em xin nói thẳng các giới hạn của đồ án."*

*"Một: em **chưa có file Excel thật** của trường, chỉ có ảnh màn hình, nên mẫu file được thiết kế theo cột trong ảnh."*

*"Hai: các **ngưỡng báo sớm và trọng số chưa được hiệu chỉnh** bằng dữ liệu thật — đó là giá trị khởi đầu hợp lý, cần nhà trường thử nghiệm."*

*"Ba: dữ liệu demo chỉ mô phỏng **ba đến bốn học phần** mỗi lớp, và mã học phần được suy từ mã lớp học phần — đây là giả định chưa được phòng Đào tạo xác nhận, nên hệ thống cho phép điền mã riêng."*

*"Hướng phát triển: kết nối trực tiếp với hệ thống của trường thay vì nhập file; dùng dữ liệu nhiều học kỳ để hiệu chỉnh ngưỡng; và bổ sung ẩn danh hóa dữ liệu sinh viên khi ra trường."*

*"Tóm lại, em đã xây dựng một hệ thống **phát hiện sớm** sinh viên có nguy cơ từ bốn nguồn dữ liệu, với **12 luật cấu hình được**, **xử lý trung thực việc thiếu dữ liệu**, và **giữ con người ở vị trí quyết định**."*

*"Em xin cảm ơn quý thầy cô đã lắng nghe. Em rất mong nhận được câu hỏi và góp ý của hội đồng."*

[Cúi chào nhẹ. Đứng yên, nhìn hội đồng.]

---

## Phần 4 — Trả lời câu hỏi của hội đồng

**Công thức trả lời 3 bước** (dùng cho mọi câu): *Trả lời thẳng 1 câu → Giải thích 1–2 câu → Chỉ bằng chứng (màn hình / tài liệu).* Không nói quá 1 phút mỗi câu.

### 4.1 Câu hỏi về ý tưởng, nghiệp vụ

**H: Hệ thống này khác gì lọc bằng Excel?**
*"Dạ, Excel lọc được một nguồn tại một thời điểm. Hệ thống của em kết hợp bốn nguồn, theo dõi qua nhiều lần đánh giá — biết sinh viên đang xấu đi hay tốt lên, tự mở lại cảnh báo khi xấu hơn, và ghi lại cố vấn đã hỗ trợ gì. Excel không làm được vòng đời và lịch sử đó."*

**H: Sao không dùng học máy (AI) để dự đoán?**
*"Dạ, em chọn luật vì ba lý do. Một, trường chưa có dữ liệu lịch sử có nhãn để huấn luyện. Hai, cảnh báo phải **giải thích được** — cố vấn cần biết 'vắng 21,7%' chứ không phải 'mô hình nói 0,8'. Ba, luật bám theo quy chế, nhà trường kiểm soát được. Khi có đủ dữ liệu nhiều học kỳ, học máy là hướng phát triển hợp lý, và điểm rủi ro hiện tại có thể là đầu vào cho nó."*

**H: Ngưỡng 10%, 15% lấy ở đâu?**
*"Dạ, ngưỡng 20% là theo quy chế. 10% và 15% là em đề xuất để báo trước khi chạm 20% — khoảng một nửa và ba phần tư ngưỡng cấm thi. Em ghi rõ là **chưa hiệu chỉnh bằng dữ liệu thật**, và quản trị viên đổi được, có chạy thử trước khi áp dụng."*

**H: Trọng số 0,4 / 0,3 / 0,3 lấy ở đâu?**
*"Dạ, điểm danh nặng nhất vì là nguồn duy nhất có hậu quả cứng theo quy chế và cập nhật hằng tuần. Đây là giá trị khởi đầu. Điểm rủi ro chỉ dùng để sắp xếp, không tạo cảnh báo, nên nếu trọng số chưa tối ưu thì cũng không làm sai danh sách cảnh báo."*

**H: Hệ thống báo sai thì sao?**
*"Dạ, cố vấn có trạng thái 'bỏ qua' kèm lý do. Mọi cảnh báo là tham khảo, không đổi học vụ. Nếu là do nạp nhầm file, quản trị viên hoàn tác lô, cảnh báo tương ứng tự chuyển sang 'không còn hiệu lực'."*

**H: Sinh viên không có dữ liệu thì sao?**
*"Dạ, hệ thống ghi 'Chưa đủ dữ liệu' và để trống điểm rủi ro, không coi là an toàn. Em có thể mở lớp Khoa học dữ liệu, sinh viên 919 để thầy cô xem."*

**H: Sao sinh viên phải chờ cố vấn xác nhận mới thấy cảnh báo?**
*"Dạ, để sinh viên nhận cảnh báo cùng với sự hỗ trợ của cố vấn, tránh việc sinh viên hoang mang vì một nhãn tự động có thể sai."*

### 4.2 Câu hỏi cần mở màn hình

| Hội đồng hỏi | Mở đâu | Mã luật | Làm được khi |
|---|---|---|---|
| Vắng đúng 20% ra mức gì? | GV001 → KTPM2411904 (Hệ quản trị CSDL 12/60) → Cao; 903 (21,7%) → Rất cao | ATT-01 | luôn |
| Vắng tăng nhanh? | KTPM2411903, 913; KHMT2411904. Đối chứng: KTPM 904 tăng 5 < 6 tiết → không | ATT-02 | luôn |
| Không làm trắc nghiệm, điểm thấp? | GV002 → CNTT2411903 (bỏ 2 bài), 905 (điểm thấp); 906 đúng 50% → không | LMS-01, LMS-02 | trước chốt |
| Không nộp, nộp trễ bài thực hành? | CNTT2411903, 908, 907 (trễ — mức Thấp, không email); 909 bài chưa tới hạn → chưa báo ở mốc 10/10 | LMS-03, LMS-04 | trước chốt |
| Nhiều nguồn cùng xấu? | GV004 → KHMT2411903 (3 nguồn); đối chứng CNTT 903: 2 nguồn ở 2 môn khác nhau → không | COMB-01 | trước chốt |
| Học lại? | GV003 → HTTT2411903, 904 (lần học 2 do hệ thống tự đếm); 905 học lại nhưng ổn → không | COMB-02 | luôn |
| Rớt môn? | KTPM2411913 (không được dự thi), 914 (vắng thi) | ACA-01 | sau Chạy 2 |
| Tín chỉ rớt, ĐTB, A = 3,8? | KTPM2411915 (rớt 75%, ĐTB 0,25), 918 (1,93 vì A = 3,8); HTTT 910 đúng 2,0 → không | ACA-02, ACA-03 | **sau chốt** |
| Sa sút so với học kỳ trước? | GV003 → HTTT2411906, 907 (giảm đúng 1,0), 908 (2 học kỳ liền chạm quy chế) | ACA-04 | **sau chốt** |
| Sinh viên chuyển đến? | GV005 → KHDL2411918 "Một phần", 919 "Chưa đủ" | — | luôn |
| Phân quyền? | GV002 dán đường dẫn `/advisor/students/KTPM2411903` → bị chặn | — | luôn |
| File lỗi / nạp nhầm? | `minh-hoa-loi/` → dòng lỗi → tải file lỗi; hoàn tác lô | — | **trước chốt** |
| Hiệu năng, sao lưu, bảo mật? | `docs/bao-cao/02-hieu-nang.md`, `03-sao-luu-khoi-phuc.md`, `01-ra-soat-bao-mat.md` | — | luôn |

**Lưu ý trạng thái** (nói trước với hội đồng nếu được yêu cầu làm):
- *Rút học phần* (KHDL2411903): làm trước chốt; khi đó hộp thoại chốt chỉ còn **1** sinh viên thiếu kết quả.
- *Đổi cố vấn lớp KTPM sang GV002*: GV002 sẽ thấy cả cảnh báo KTPM; làm xong đổi lại GV001.
- *Kích hoạt luật mới*: số cảnh báo sẽ khác số đã trình bày — chỉ chạy thử.
- Sau chốt mà hội đồng muốn xem lại nhập file: mở video/ảnh, hoặc nói *"Em có test tự động Playwright làm đúng các bước này"*.

### 4.3 Câu hỏi kỹ thuật

**H: Sao chọn Next.js mà không tách backend riêng?**
*"Dạ, một khung cho cả giao diện và máy chủ giúp một người làm đồ án quản lý gọn. Việc nặng em vẫn tách ra worker riêng chạy trong container riêng, nên giao diện không bị ảnh hưởng."*

**H: Làm sao biết luật chạy đúng?**
*"Dạ, mỗi luật có test riêng gồm ca đúng ngưỡng, ca sát ngưỡng và ca không đủ dữ liệu. Ngoài ra có test nghiệm thu so khớp toàn bộ 100 sinh viên với bảng em tính tay **trước** khi sinh dữ liệu."*

**H: "Không dùng dữ liệu tương lai" là sao?**
*"Dạ, khi chạy với mốc ngày 10/10, hệ thống chỉ lấy điểm danh, bài làm, kết quả có ngày đến 10/10. Em có test riêng: thêm dữ liệu sau mốc vào thì kết quả tại mốc **không đổi**."*

**H: Chạy hai lần có bị trùng cảnh báo không?**
*"Dạ không. Mỗi sinh viên mỗi học kỳ chỉ có một cảnh báo đang mở — được khóa ở mức cơ sở dữ liệu. Chạy lại cùng mốc không tạo cảnh báo mới, không gửi thông báo mới."*

**H: Dữ liệu lớn thì sao?**
*"Dạ, em đo với 5.000 sinh viên: chạy cả học kỳ khoảng 27 giây, chạy riêng một học phần khoảng 2 giây, các màn hình dưới 0,1 giây. Đánh giá chạy theo lô 200 sinh viên trong worker."*

**H: Mật khẩu, bảo mật lưu thế nào?**
*"Dạ, em dùng thư viện xác thực Better Auth, không tự viết hàm băm mật khẩu. Đăng nhập sai nhiều lần bị giới hạn và ghi nhật ký. Khi triển khai thật cần bật HTTPS — em ghi rõ trong hướng dẫn, môi trường demo trên máy cá nhân chưa bật."*

### 4.4 Khi không biết câu trả lời

- *"Dạ, câu hỏi này em chưa tìm hiểu tới. Em xin ghi nhận và bổ sung vào hướng phát triển."*
- *"Dạ, theo em hiểu câu hỏi của thầy/cô là [nhắc lại]… có đúng không ạ?"* — dùng khi chưa hiểu câu hỏi; vừa mua thời gian vừa tránh trả lời lạc đề.
- **Không bịa số.** Không chắc thì nói: *"Con số chính xác em ghi trong báo cáo kiểm thử, em xin phép mở ra."*

---

## Phần 5 — Câu cứu nguy khi demo trục trặc

| Sự cố | Nói gì | Làm gì |
|---|---|---|
| Trang tải lâu | *"Hệ thống đang xử lý, trong lúc chờ em xin giải thích…"* → nói tiếp ý của bước đó | Chờ tối đa 15 giây |
| Lỗi / trắng trang | *"Dạ, máy demo đang gặp sự cố, em xin phép chuyển sang video em đã quay sẵn từ đúng dữ liệu này."* | Mở video, nói theo Phần 3 |
| Bấm nhầm, kích hoạt luật | *"Em vừa kích hoạt nhầm; số liệu phía sau sẽ khác một chút, phần còn lại không đổi."* | Đi tiếp, không cố sửa trước hội đồng |
| Quên bước tiếp theo | *"Tiếp theo em xin trình bày phần…"* | Nhìn bản in Phần 3 (để sẵn trên bàn) |

---

## Phần 6 — Tờ ghi nhớ 1 trang (in ra, để trên bàn)

- **Câu một dòng:** gom 4 nguồn → 12 luật → cảnh báo cố vấn → chỉ tham khảo.
- **Số cần nhớ:** 5 lớp × 20 SV · 41 dấu hiệu → **24** cảnh báo (10/10) → **29** (20/11) → **35** (chốt) · vắng **> 20%** cấm thi · A = **3,8** · trọng số 0,4/0,3/0,3 · >400 test · 5.000 SV ~27 giây.
- **Thứ tự demo:** Đăng nhập → Bắt đầu → Nhập (32 file, Tuấn/Tú, file lỗi) → Chạy 10/10 → Tổng quan (KHDL 919) → GV001 ma trận, 903, xác nhận → SV 903 → GV004 giải quyết 905 → Chạy 20/11 → 905 mở lại + MailHog → Chạy thử luật 8% (bỏ) → Chốt → HTTT 908, KTPM 918 → Nhật ký.
- **Ba điều phải nói bằng được:** (1) không tự quyết học vụ; (2) thiếu dữ liệu ≠ an toàn; (3) đã giải quyết mà xấu hơn thì tự mở lại.
