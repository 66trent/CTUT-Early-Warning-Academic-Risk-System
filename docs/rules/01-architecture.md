# 01 — Kiến trúc Web

Xem `00-project-context.md` cho định nghĩa entity/enum. File này quy định cách tổ chức code.

## Nguyên tắc phân lớp

- MUST: dùng Next.js App Router làm nền tảng duy nhất. Không dựng Express/Fastify riêng.
- MUST: mọi truy cập dữ liệu đi qua Server Component, Server Action, hoặc Route Handler. Client Component KHÔNG BAO GIỜ import TypeORM/`DataSource`.
- MUST: dùng Route Handler (`app/api/**/route.ts`) chỉ cho: endpoint của Better Auth, export file (GET), endpoint gọi bởi worker. Mọi thao tác khác dùng Server Action.
- MUST: tổ chức code theo 4 module nghiệp vụ, không import chéo trực tiếp giữa các module (giao tiếp qua service):
  `data-import` (nhập CSV) · `rule-engine` (tính luật/RiskScore) · `alerts` (cảnh báo, can thiệp, thông báo, màn hình CVHT/sinh viên) · `admin` (tài khoản, cấu hình luật, tổng quan).

## Cấu trúc thư mục bắt buộc

```
src/
  app/                 # Chỉ chứa page.tsx, layout.tsx, route.ts — không chứa business logic
  db/
    data-source.ts     # TypeORM DataSource singleton
    entities/          # Mọi entity (*.entity.ts) — đặt tập trung vì quan hệ chéo module
    enums.ts           # Nguồn duy nhất cho mọi enum dùng chung
    migrations/        # Migration TypeORM (chỉ bảng nghiệp vụ)
  modules/
    <module>/
      actions/         # Server Actions: lấy session, gọi assertScope(), gọi service, ghi audit log
      services/        # Logic nghiệp vụ — KHÔNG import next/headers, KHÔNG gọi session
      validators/      # Zod schema
  lib/
    auth.ts            # Better Auth config
    authz.ts           # assertScope()
    audit.ts           # writeAuditLog() dùng chung — xem 06-security.md
    queue/             # BullMQ queue definitions
  workers/             # Entry point riêng cho BullMQ worker — build image Docker riêng
scripts/               # db-init.ts, run-migrations.ts, seed.ts
docs/                  # rules/, implement.md, demo-data/ (bộ dữ liệu demo + kết quả mong đợi)
tests/                 # Vitest; dùng docs/demo-data làm fixture nghiệm thu
```

- MUST: tách `services/` khỏi `actions/`. Logic tính toán thuần (đặc biệt `rule-engine/evaluator/`) test được không cần session/DB thật.
- MUST NOT: đặt business logic trong `app/`.

## TypeORM

- MUST: `synchronize: false` ở MỌI môi trường. Schema chỉ thay đổi qua migration.
- MUST: `tsconfig.json` bật `experimentalDecorators` + `emitDecoratorMetadata`; `import 'reflect-metadata'` ở điểm vào của `data-source.ts`; `next.config` khai báo `serverExternalPackages: ['typeorm']` (kiểm tra tên option theo phiên bản Next.js đang dùng) để bundler không phá decorator.
- MUST: `DataSource` cache qua `globalThis` (tránh tạo nhiều connection pool khi hot-reload dev); hàm `getDataSource()` tự `initialize()` nếu chưa khởi tạo. Cache theo class `User` của từng bản sao module: bản build production của Next.js nhân bản module dùng chung giữa route handler và trang, mà TypeORM tra metadata theo đúng đối tượng class — dùng 1 DataSource chung cho mọi bản sao gây `EntityMetadataNotFoundError` (đã gặp ở Phase 1, chỉ lộ ra khi `next build`). Dev hot-reload: bản sao mới hủy DataSource cũ.
- MUST: khai báo kiểu cột tường minh (`@Column({ type: 'varchar', length: 20 })`, `type: 'jsonb'`, `type: 'enum'`) và quan hệ dạng arrow `@ManyToOne(() => Student, ...)` — MUST NOT dựa vào suy luận kiểu từ metadata (dễ lỗi khi bundle, dễ sinh migration sai).
- MUST: dùng `SnakeNamingStrategy` — property camelCase trong code, cột snake_case trong DB. Tên property khớp 100% với data schema (`09`–`12`).
- MUST NOT: dùng `eager: true` hoặc lazy relation (`Promise<...>`). Luôn nạp quan hệ tường minh qua `relations`/`QueryBuilder` để tránh N+1 và tải thừa.
- MUST: enum định nghĩa 1 lần ở `src/db/enums.ts`. Enum nghiệp vụ ỔN ĐỊNH (`UserRole`, `UserAccountStatus`, `Severity`, `AlertStatus`, `DataStatus`, `DataCompletenessLevel`, `EnrollmentStatus`, `AttemptOutcome`, `RuleStatus`, `CourseResultStatus`, `QuizAttemptStatus`, `ImportSource`, `ImportBatchStatus`) dùng `@Column({ type: 'enum', enum: X })`. Danh sách HAY MỞ RỘNG (`ImportDataType`, `ImportErrorReason` lưu `varchar(40)`; `AuditLog.action` lưu `varchar(60)` theo `11`) + kiểm tra bằng TypeScript union và Zod — tránh migration `ALTER TYPE ... ADD VALUE` mỗi lần thêm giá trị.
- MUST: sinh migration bằng `typeorm migration:generate`, MUST review file sinh ra trước khi chạy. MUST NOT sửa tay migration đã áp dụng — tạo migration mới để sửa.
- MUST: đăng ký migration trong `data-source.ts` bằng import trực tiếp từng class vào mảng `migrations: [...]` — MUST NOT dùng glob path (lỗi ESM loader khi chạy CLI/CI). Chạy bằng `scripts/run-migrations.ts` (`runMigrations({ transaction: 'each' })`).
- MUST: pool riêng — web `extra: { max: 20 }`, worker `extra: { max: 10 }`.
- MUST: số liệu tổng hợp (sĩ số lớp, đếm cảnh báo) dùng truy vấn `COUNT ... GROUP BY` tường minh qua QueryBuilder — MUST NOT dựa vào `loadRelationCountAndMap` khi đi kèm `leftJoinAndSelect` (đã cho kết quả 0 sai).
- MUST: transaction dùng `dataSource.transaction(async (em) => ...)`, truyền `em` xuống mọi truy vấn trong cùng transaction.
- MUST: validate bằng Zod trước khi ghi cột `jsonb` (`RuleVersion.condition`, `RuleTrigger.inputSnapshot`, `RiskScoreLog.componentsUsed`) — TypeORM không kiểm tra cấu trúc bên trong.

## Better Auth và TypeORM — hai hệ quản lý bảng tách biệt

- MUST: Better Auth kết nối thẳng PostgreSQL bằng `pg` Pool; bảng của nó (user/session/account/verification) nằm trong schema Postgres riêng `auth` (đặt `search_path` cho Pool của Better Auth). Schema `auth`, extension `uuid-ossp` và bảng Better Auth được tạo bởi `scripts/db-init.ts` (`npm run db:init`) TRƯỚC khi chạy migration TypeORM.
- MUST NOT: khai báo bảng của Better Auth thành entity TypeORM; migration TypeORM MUST NOT đụng schema `auth`; MUST NOT thêm cột vào bảng của Better Auth (trạng thái tài khoản chỉ nằm ở `public.users.account_status`).
- MUST: entity `User` (nghiệp vụ, schema `public`) giữ `role` và liên kết với tài khoản Better Auth qua cùng `userId`. Vai trò MUST được đọc từ entity `User` ở tầng server mỗi request (hoặc đưa vào session qua cơ chế custom session của Better Auth), không tin role do client gửi.
- MUST: đăng nhập — `STUDENT`: chỉ Google OAuth. `ADVISOR`/`ADMIN`: email + mật khẩu; Google với email `STAFF_EMAIL_DOMAIN` chỉ khi đã có tài khoản `ACTIVE`. Liên kết entity `User` qua `User.authUserId`.
- MUST: kiểm tra trong `databaseHooks.user.create.before` của Better Auth và ném `APIError` (từ `better-auth/api`) với mã cố định: `INVALID_DOMAIN`, `NO_STUDENT_PROFILE`, `STAFF_ACCOUNT_NOT_FOUND`, `ACCOUNT_INACTIVE`, `EMAIL_NOT_VERIFIED` (email Google/đăng ký chưa xác minh) — để mã lỗi đi tới trang `/login` thay vì bị gộp thành lỗi chung. `databaseHooks.user.create.after` gán `User.authUserId`. `errorCallbackURL` = `/login`; trang login ánh xạ mã → thông báo (`NO_STUDENT_PROFILE` chuyển sang `/no-profile`).
- Chính sách cho phép tạo/liên kết tài khoản nằm ở 1 hàm thuần `decideNewAuthUser()` (`src/lib/auth-policy.ts`), áp cho cả `user.create.before` và `account.create.before` (liên kết Google vào tài khoản có sẵn). Endpoint `/sign-up/email` bị chặn khi gọi qua HTTP; đăng ký CVHT chỉ qua Server Action: tạo `User` `PENDING_APPROVAL` trước → `auth.api.signUpEmail` (gửi email xác minh, `requireEmailVerification`) → lỗi thì xóa `User` vừa tạo.
- MUST NOT: tự tạo `User`/`Student` trong hook hay callback đăng nhập (không auto-provisioning); MUST NOT suy ra mã sinh viên từ email — xem `09-data-schema-identity.md` và `06-security.md`.
- MUST: chỉ đăng ký provider Google khi `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` có giá trị; khi thiếu, trang login ẩn nút Google và hiện hướng dẫn cấu hình (tránh lỗi `PROVIDER_NOT_FOUND`).
- MUST: `getCurrentUser()` bọc bằng `React.cache()` (Layout và Page gọi song song trong 1 request). Hàm này chỉ ĐỌC; ngoại lệ duy nhất là gắn `authUserId` khi tìm thấy theo email — viết idempotent.

## Server Action — dữ liệu trả về

- MUST: Server Action trả về object thuần (POJO/DTO) qua hàm map tường minh (VD: `toClassDto(entity)`), dạng `{ ok: true, data } | { ok: false, code, message }`. MUST NOT trả instance entity TypeORM hay object có quan hệ vòng — Next.js báo lỗi "Only plain objects… can be passed to Client Components".

## BullMQ Worker

- MUST: worker chạy container Docker riêng, không chung process với Next.js server; worker tự khởi tạo `DataSource` riêng.
- MUST: có các queue: `import-batch-process`, `calculate-risk-score`, `evaluate-hard-triggers`, `send-notifications`.
- MUST: mọi job idempotent — dùng khóa nghiệp vụ làm BullMQ `jobId` để chặn job trùng.
- MUST: job lỗi có retry giới hạn (`attempts: 3`, backoff exponential), không để lỗi biến mất âm thầm.

## Rule Engine — module lõi

- MUST: code trong `modules/rule-engine/evaluator/` không import `next/*` và không import `DataSource`/entity repository — nhận dữ liệu đã nạp sẵn, trả kết quả.
- MUST: mọi hàm evaluator là pure function (input → output, không tự truy vấn DB).
- MUST: mỗi luật là 1 file riêng trong `modules/rule-engine/evaluator/rules/` (VD: `att-01.ts`), export 1 hàm đánh giá pure và metadata (`ruleCode`, `scope`). Các luật được đăng ký vào 1 registry duy nhất (`rules/index.ts`); engine chỉ duyệt registry. MUST NOT gộp nhiều luật vào 1 khối `if/else` hoặc `switch` lớn.
- MUST: thêm luật mới = (1) cập nhật `08-business-rules-catalog.md`, (2) thêm 1 file luật + đăng ký vào registry, (3) seed `Rule`/`RuleVersion`, (4) viết test 4 ca. MUST NOT sửa engine lõi, schema hay luồng tạo `Alert` chỉ để thêm 1 luật.

## Ranh giới bắt buộc

- MUST NOT: bất kỳ module nào ngoài tiến trình nhập `Student` từ nguồn SIS (`modules/data-import`) được cập nhật cột `Student.officialAcademicStatus`.
- MUST: mọi thay đổi code chạm `Alert`/`RuleTrigger`/`RiskScoreLog` phải giữ nguyên `Alert.isReferenceOnly = true`.

## Docker

- MUST: `docker-compose.yml` gồm tối thiểu: `app`, `worker`, `postgres`, `redis`, `minio` (lưu file CSV gốc của `ImportBatch`), `mailhog` (chỉ profile `dev`).
- App build Next.js `output: 'standalone'`; worker đóng gói bằng esbuild (`npm run worker:build`) — esbuild KHÔNG phát `emitDecoratorMetadata`, nên quy tắc "khai báo kiểu cột tường minh, quan hệ dạng arrow" ở mục TypeORM là bắt buộc để worker chạy đúng. Port chỉ mở trên `127.0.0.1`.
- MUST: validate biến môi trường bằng Zod khi khởi động (`src/lib/env.ts`) — app phải crash ngay nếu thiếu biến bắt buộc. Biến tính năng tùy chọn (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) được phép trống. Bắt buộc có: `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `STAFF_EMAIL_DOMAIN`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `DEMO_MODE`, `NEXT_PUBLIC_APP_NAME`, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`. `DEMO_ADVISOR_PASSWORD` bắt buộc khi `DEMO_MODE=true`. `PROCESS_ROLE` (`web`/`worker`) chọn kích thước pool DB. `getEnv()` parse lười (để `next build` không cần secret) và được gọi lúc khởi động trong `src/instrumentation.ts`, worker, scripts.

## CI và sao lưu

- MUST: thứ tự CI: `typecheck` → `lint` → `format:check` → `db:init` → `migration:run` → `seed` → `test` → `build`.
- MUST: trước migration xóa/đổi bảng có dữ liệu: `pg_dump` vào `backups/` (đã `.gitignore`).

## Backup & Restore

- MUST: full backup PostgreSQL hàng ngày (off-peak), lưu tách biệt khỏi server chính, mã hóa/kiểm soát truy cập như dữ liệu production (xem `04-legal-compliance.md`).
- MUST: RPO ≤ 24 giờ, RTO ≤ 4 giờ (ngưỡng tối thiểu cho đồ án).
- MUST: file CSV gốc (`ImportBatch.originalFilePath` trong MinIO) lưu tối thiểu 1 học kỳ.
- SHOULD: diễn tập khôi phục ít nhất 1 lần trước khi nộp/triển khai.
