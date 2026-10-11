# 03 — Thiết kế UI

Xem `00-project-context.md` cho glossary (đặc biệt: enum `Severity`, `DataCompletenessLevel`, entity `Alert`). File này quy định thư viện và thành phần giao diện.

## Thư viện component

- MUST: dùng shadcn/ui cho mọi thành phần chuẩn (Form, Table, Dialog, Dropdown, Badge, Tabs, Sheet, Toast).
- MUST: dùng Tremor chỉ cho khu vực biểu đồ/KPI (màn hình tổng quan của CVHT và trang tổng quan ADMIN). MUST NOT dùng Tremor cho form nhập liệu hoặc bảng có thao tác dòng — dùng shadcn `Table`.
- MUST NOT: cài thêm UI kit thứ 3 (Ant Design, MUI...). Nhu cầu mới chưa có trong shadcn/ui thì tự dựng bằng Radix primitives + Tailwind.

## Nhận diện giao diện — trắng và xanh dương (chuẩn hệ thống quản lý trường học)

Cảm giác cần đạt: sáng, sạch, đáng tin cậy, thân thiện với sinh viên và giảng viên. Nền trắng là chủ đạo, xanh dương dùng cho hành động và điểm nhấn.

- MUST: khai báo token màu 1 lần trong `globals.css` (Tailwind 4 `@theme` + biến shadcn), MUST NOT hard-code mã hex trong component. Dùng đúng bảng sau cho light mode:

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--background` | `#FFFFFF` | Nền trang, card, sidebar, header |
| `--muted` / nền vùng làm việc | `#F8FAFC` (slate-50) | Nền khu vực nội dung phía sau card, hàng xen kẽ của bảng |
| `--primary` | `#2563EB` (blue-600) | Nút chính, link, mục menu đang chọn, focus ring |
| `--primary-hover` | `#1D4ED8` (blue-700) | Hover/active của nút chính |
| `--primary-soft` | `#EFF6FF` (blue-50) | Nền mục menu đang chọn, hàng được chọn, vùng nhấn nhẹ |
| `--accent-strong` | `#1E3A8A` (blue-900) | Tiêu đề lớn, logo, số KPI |
| `--foreground` | `#0F172A` (slate-900) | Văn bản chính |
| `--muted-foreground` | `#64748B` (slate-500) | Văn bản phụ |
| `--border` | `#E2E8F0` (slate-200) | Viền card, bảng, input |

- MUST: bố cục chuẩn quản lý trường học: sidebar trắng bên trái có logo trường ở đầu (mục đang chọn nền `--primary-soft`, chữ và icon `--primary`), header trắng mỏng có tên người dùng + vai trò, vùng nội dung nền `#F8FAFC` chứa các card trắng bo góc `rounded-lg` viền `--border` và bóng nhẹ (`shadow-sm`). Mobile: sidebar thu thành Sheet.
- MUST: chỉ 1 nút chính (`--primary`) nổi bật trên mỗi vùng thao tác; hành động phụ dùng `outline`/`ghost`. MUST NOT dùng nhiều màu nhấn khác ngoài xanh dương cho điều hướng và nút.
- MUST: font `Be Vietnam Pro` (hỗ trợ đầy đủ tiếng Việt) nạp qua `next/font/google` với subset `vietnamese` + `latin`; font phụ fallback `system-ui`. Cỡ chữ nội dung tối thiểu 14px, tiêu đề trang 24px.
- MUST: radius thống nhất `0.5rem`; khoảng cách theo thang 4px của Tailwind; MUST NOT dùng gradient sặc sỡ, hình nền nặng hoặc hiệu ứng động gây xao nhãng. Chuyển động chỉ ≤200ms, dùng cho hover/mở Sheet.
- MUST: tương phản chữ/nền tối thiểu WCAG AA (4.5:1). Chữ trắng trên `--primary` đạt chuẩn — MUST NOT dùng blue-400 trở nhạt làm nền nút có chữ trắng.
- MUST: Tremor cấu hình theo thang xanh dương (`blue`, `sky`, `slate`) cho biểu đồ thông thường. Biểu đồ phân bố theo Severity MUST dùng đúng bảng màu Severity bên dưới, không dùng thang xanh.
- SHOULD: trang đăng nhập 2 cột trên desktop — bên trái nền `--primary-soft` với logo và một câu giới thiệu hệ thống, bên phải form trên nền trắng.

## Hệ thống màu theo Severity — định nghĩa 1 lần, dùng khắp app

| Severity | Class Tailwind |
|---|---|
| `LOW` | `bg-slate-100 text-slate-700` |
| `MEDIUM` | `bg-amber-100 text-amber-700` |
| `HIGH` | `bg-orange-100 text-orange-700` |
| `CRITICAL` | `bg-red-100 text-red-700` |

- MUST: định nghĩa bảng màu này 1 lần trong `tailwind.config`/CSS variables, import dùng lại — không hard-code màu Severity ở từng component.
- MUST: `DataCompletenessLevel` dùng badge viền (outline) màu slate, phân biệt bằng icon/nét viền chứ không bằng màu: `FULL` = icon tròn đầy, `PARTIAL` = icon tròn nửa, `INSUFFICIENT` = viền nét đứt. MUST NOT dùng đỏ-vàng-xanh hay xanh dương thương hiệu — đây là 2 khái niệm độc lập với Severity, tránh hiểu nhầm "thiếu dữ liệu" thành "rủi ro cao/thấp".
- MUST NOT: dùng đỏ/xanh lá cho `AlertStatus`, và MUST NOT dùng xanh dương thuần (trùng màu nút/link thương hiệu). Dùng: `OPEN` violet, `ACKNOWLEDGED` cyan, `IN_PROGRESS` indigo, `REOPENED` violet viền, `RESOLVED` slate kèm icon dấu tick, `DISMISSED`/`INVALIDATED` slate nhạt. Luôn kèm nhãn chữ.

## Component bắt buộc gắn với ràng buộc nghiệp vụ

- MUST: mọi nơi hiển thị `Alert` có dòng cố định, không được ẩn/thu gọn: "Cảnh báo sớm — mang tính tham khảo, không phải quyết định học vụ chính thức".
- MUST: mọi nơi hiển thị `RiskScoreLog.riskScoreValue` kèm badge `dataCompletenessLevel` ngay cạnh — MUST NOT hiển thị con số RiskScore đơn độc không có ngữ cảnh độ tin cậy.
- MUST: danh sách `RuleTrigger.reason` của 1 `Alert` hiển thị dạng Accordion — mỗi luật vi phạm là 1 mục riêng, mở rộng mới thấy `inputSnapshot` chi tiết.

## Bảng dữ liệu

- MUST: dùng `@tanstack/react-table` + shadcn `Table` cho mọi danh sách có lọc/sắp xếp/phân trang.
- MUST: bảng dòng lỗi nhập liệu có cột "Lý do lỗi" (Badge đỏ nhạt) và nút "Tải xuống" ở đầu bảng.
- MUST: bảng danh sách sinh viên nguy cơ mặc định sắp xếp Severity giảm dần, `CRITICAL` luôn ở trên cùng.

## Form

- MUST: dùng `react-hook-form` + `zodResolver` + shadcn `Form` cho mọi form. MUST NOT tự quản lý form bằng `useState` rời rạc cho từng field.
- MUST: form sửa `RuleVersion` hiển thị giá trị hiện tại (phiên bản `ACTIVE`) trước khi cho sửa, và cảnh báo rõ "Lưu sẽ tạo phiên bản mới, không ghi đè" trước khi submit.

## Responsive & Dark mode

- MUST: responsive tối thiểu 3 breakpoint: mobile (<640px), tablet (640–1024px), desktop (>1024px).
- MUST: light mode là mặc định và là giao diện chính; dùng `next-themes` cho dark mode (nền slate-900, `--primary` sáng hơn `#3B82F6`, chữ trên nút primary dùng slate-950 vì chữ trắng trên `#3B82F6` chỉ đạt 3.7:1 < AA) — dùng `useTheme` của `next-themes` cho nút chuyển, không tự viết cơ chế lưu theme riêng.

## Giao diện Sinh viên — tách biệt khỏi giao diện CVHT/Admin

- MUST NOT: hiển thị `RuleTrigger.inputSnapshot` thô cho role `STUDENT` — chỉ hiển thị `reason` đã diễn giải dễ hiểu, ngôn ngữ tích cực.
- MUST NOT: dùng màu đỏ chớp/nhấp nháy hoặc ngôn ngữ đe dọa trên giao diện sinh viên.
