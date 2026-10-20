# CTUT-EWARS — Hệ thống cảnh báo sớm rủi ro học tập

Đồ án tốt nghiệp — Trường Đại học Kỹ thuật - Công nghệ Cần Thơ.

Hệ thống phát hiện **dấu hiệu rủi ro học tập** của sinh viên từ 4 nguồn dữ liệu (điểm danh theo tiết, bài trắc nghiệm LMS, bài thực hành LMS, kết quả học phần đã khóa điểm) bằng **12 luật nghiệp vụ cấu hình được**, tạo **cảnh báo sớm mang tính tham khảo** gửi Cố vấn học tập xử lý. Hệ thống KHÔNG sửa tình trạng học vụ chính thức của sinh viên.

- 3 vai trò: **Admin** (nhập dữ liệu, cấu hình luật, giám sát — chỉ đọc cảnh báo), **Cố vấn học tập** (xác nhận, can thiệp, đóng cảnh báo), **Sinh viên** (xem tình hình học tập của mình).
- Công nghệ: Next.js 16 · PostgreSQL 16 · TypeORM · Better Auth · BullMQ + Redis · MinIO · Tailwind 4 + shadcn/ui · Recharts · Docker.
- Tài liệu: luật nghiệp vụ `docs/rules/08-business-rules-catalog.md` · dữ liệu demo + kết quả mong đợi `docs/demo-data/KET_QUA_MONG_DOI.md` · kịch bản demo `docs/demo-script.md` · báo cáo kiểm tra `docs/bao-cao/` · ảnh màn hình `docs/screenshots/` (mục 6).

## 1. Chạy trên máy sạch

**Cần cài**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (đang chạy), [Node.js 22](https://nodejs.org/), Git. Các cổng `3000, 5432, 6379, 9000, 9001, 1025, 8025` phải trống.

```bash
git clone https://github.com/66trent/CTUT-Early-Warning-Academic-Risk-System.git ewars
```

```bash
cd ewars
```

```bash
npm ci
```

**Tạo file `.env`** từ mẫu rồi điền các giá trị trống:

```bash
cp .env.example .env
```

| Biến | Điền gì |
|---|---|
| `POSTGRES_PASSWORD` | mật khẩu tự chọn; sửa `DATABASE_URL` cho khớp (`postgresql://ewars:<mật khẩu>@localhost:5432/ewars`) |
| `AUTH_SECRET` | chuỗi ngẫu nhiên — sinh bằng lệnh bên dưới |
| `ADMIN_SEED_PASSWORD` | mật khẩu Admin đầu tiên (≥ 8 ký tự) |
| `DEMO_ADVISOR_PASSWORD` | mật khẩu 2 tài khoản Cố vấn học tập demo (≥ 8 ký tự) |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | tự chọn (secret ≥ 8 ký tự) |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Khởi động** (lần đầu build image ~3–5 phút):

```bash
docker compose --profile dev up -d --build
```

**Tạo bảng và dữ liệu nền** (7 khoa, Admin đầu tiên, 12 luật):

```bash
npm run db:init
```

```bash
npm run migration:run
```

```bash
npm run seed
```

Mở http://localhost:3000 → tab **Cán bộ** → đăng nhập bằng `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`. Trang **Bắt đầu** hướng dẫn từng bước vận hành.

**Nạp sẵn bộ dữ liệu demo** (tùy chọn, cần `DEMO_MODE=true`): tạo GV001/GV002, lớp KTPM2411 (20 sinh viên), học kỳ 1 2025–2026, nạp 6 file demo (thêm `--evaluate=2` để chạy luôn 2 mốc đánh giá).

```bash
npm run demo:reset -- --yes
```

`demo:reset` **XÓA toàn bộ dữ liệu** rồi dựng lại bộ demo chuẩn (tự sao lưu vào `backups/` trước khi xóa).

| Địa chỉ | Dùng để |
|---|---|
| http://localhost:3000 | Ứng dụng |
| http://localhost:8025 | MailHog — xem email thông báo gửi Cố vấn học tập |
| http://localhost:9001 | MinIO — file gốc các lô nhập |

## 2. Phát triển

```bash
docker compose up -d postgres redis minio mailhog
```

```bash
npm run dev
```

```bash
npm run worker:dev
```

Kiểm tra trước khi gửi PR (CI chạy đúng thứ tự này):

```bash
npm run typecheck && npm run lint && npm run format:check && npm run migration:check && npm test && npm run build
```

Kiểm thử giao diện end-to-end (Playwright, 2 luồng: nạp nhiều file có dòng lỗi → sửa → nạp lại; Cố vấn học tập xác nhận + ghi can thiệp — chạy trên máy, cần app ở cổng 3000 và đã `npm run demo:reset -- --yes --evaluate=2`):

```bash
npm run test:e2e
```

## 3. Sao lưu và khôi phục

```bash
npm run backup
```

```bash
npm run restore -- backups/<file>.dump
```

- `backup` tạo `backups/ewars-<ngày-giờ>.dump`, giữ 7 bản mới nhất. `restore` mặc định khôi phục vào DB thử `<DB>_restore` để kiểm tra; ghi đè DB chính: dừng `app` + `worker` rồi thêm `--into-main --yes`.
- **Đặt lịch hằng ngày** (RPO ≤ 24 giờ):
  - Windows — Task Scheduler: tạo tác vụ chạy hằng ngày 1:00, Action `cmd.exe`, đối số `/c cd /d <thư mục ewars> && npm run backup`.
  - Linux — `crontab -e`: `0 1 * * * cd /đường/dẫn/ewars && npm run backup >> backups/backup.log 2>&1`
- File sao lưu chứa dữ liệu cá nhân: lưu tách khỏi máy chủ, giới hạn quyền truy cập. Kết quả diễn tập: `docs/bao-cao/03-sao-luu-khoi-phuc.md`.

## 4. Triển khai thật — bắt buộc

- `DEMO_MODE=false` (tắt đăng nhập nhanh, chọn mốc dữ liệu quá khứ).
- `STAFF_EMAIL_DOMAIN=@ctuet.edu.vn`; `AUTH_SECRET` sinh mới; mật khẩu mạnh cho Postgres/MinIO/Admin.
- **TLS** (`docs/rules/06`): đặt reverse proxy HTTPS (Caddy, Nginx…) trước cổng 3000, bật HSTS; `BETTER_AUTH_URL=https://<tên miền>`; `DATABASE_URL` thêm `?sslmode=require` nếu PostgreSQL ở máy khác; SMTP của trường qua TLS. Ví dụ Caddy:

  ```
  ewars.ctuet.edu.vn {
    reverse_proxy 127.0.0.1:3000
    header Strict-Transport-Security "max-age=31536000"
  }
  ```

- **Đăng nhập Google cho sinh viên**: tạo OAuth Client (Web) ở Google Cloud Console, Authorized redirect URI `https://<tên miền>/api/auth/callback/google`, điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Thiếu 2 biến này thì nút Google bị ẩn. Chỉ email `@student.ctuet.edu.vn` đã có hồ sơ mới đăng nhập được.
- **Trang chính sách dữ liệu cá nhân**: điền `PRIVACY_CONTROLLER_NAME`, `PRIVACY_CONTACT`, `PRIVACY_RETENTION` theo thông tin nhà trường.
- Lịch chạy đánh giá mỗi đêm: `EVALUATION_SCHEDULE` (cron, giờ Việt Nam; mặc định `0 2 * * *`).

## 5. Lệnh hay dùng

| Lệnh | Việc |
|---|---|
| `npm run demo:reset -- --yes` | Xóa dữ liệu, dựng lại bộ demo chuẩn |
| `npm run templates:build` | Sinh file mẫu `.xlsx` từ mẫu `.csv` (`public/templates/`) |
| `npm run perf:seed`, `npm run perf:measure` | Đo hiệu năng trên DB riêng `*_perf` (`docs/bao-cao/02-hieu-nang.md`) |
| `npm run backup`, `npm run restore` | Sao lưu / khôi phục |
| `npm run screenshots` | Chụp lại ảnh màn hình (mục 6) |

## 6. Ảnh màn hình

`docs/screenshots/<giao diện>-<khổ>-<số>-<tên>.jpg` — sáng / tối, `desktop` 1440px (tối chỉ chụp khổ này), `tablet` 768px và `mobile` 390px cho các trang chính: đăng nhập, Bắt đầu, Tổng quan Admin, Nhập dữ liệu (độ mới theo học phần, xem trước lô), Cấu hình luật, Chạy đánh giá + kết quả, Cảnh báo sớm, hồ sơ sinh viên, Khoa và lớp, Tài khoản, Nhật ký; Cố vấn học tập: Tổng quan, Cảnh báo cần xử lý, chi tiết cảnh báo, Ma trận lớp, hồ sơ, Thông báo; trang sinh viên; chính sách dữ liệu cá nhân.

Chụp lại (cần app ở cổng 3000, `DEMO_MODE=true`):

```bash
npm run demo:reset -- --yes --evaluate=2
```

```bash
npm run screenshots
```

Lệnh báo trang nào bị tràn ngang (kiểm tra giao diện điện thoại).
