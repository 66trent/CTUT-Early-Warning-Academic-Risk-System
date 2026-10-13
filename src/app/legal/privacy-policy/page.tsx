import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/lib/app-config';
import { getEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Chính sách bảo vệ dữ liệu cá nhân' };
// Đọc biến môi trường lúc chạy, không đóng băng lúc build.
export const dynamic = 'force-dynamic';

const TO_CONFIRM = '[Cần nhà trường xác nhận]';

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        {n}. {title}
      </h2>
      <div className="flex flex-col gap-2 leading-relaxed">{children}</div>
    </section>
  );
}

/**
 * Trang công khai — đủ 7 mục bắt buộc của docs/rules/04 (Luật 91/2025/QH15, Nghị định
 * 356/2025/NĐ-CP). Thông tin thật của trường đọc từ biến môi trường, MUST NOT bịa.
 */
export default function PrivacyPolicyPage() {
  const env = getEnv();
  return (
    <main className="min-h-screen bg-workspace px-4 py-10">
      <article className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border bg-background p-6 shadow-sm sm:p-10">
        <header className="flex flex-col gap-2">
          <h1>Chính sách bảo vệ dữ liệu cá nhân</h1>
          <p className="text-muted-foreground">
            Áp dụng cho hệ thống {APP_NAME}, theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và
            Nghị định 356/2025/NĐ-CP.
          </p>
        </header>

        <Section n={1} title="Bên kiểm soát dữ liệu">
          <p>Đơn vị triển khai: {env.PRIVACY_CONTROLLER_NAME ?? TO_CONFIRM}</p>
          <p>Bộ phận phụ trách bảo vệ dữ liệu và liên hệ: {env.PRIVACY_CONTACT ?? TO_CONFIRM}</p>
        </Section>

        <Section n={2} title="Loại dữ liệu xử lý">
          <p>
            <strong>Dữ liệu cơ bản:</strong> mã số sinh viên, họ tên, email sinh viên, lớp sinh hoạt
            và khoa, số liệu điểm danh tổng hợp (số buổi có mặt, đi trễ, vắng có phép, vắng không
            phép), kết quả bài kiểm tra trên LMS (lượt làm, thời điểm, điểm), kết quả học phần (điểm
            quá trình, điểm thi, điểm tổng kết).
          </p>
          <p>
            <strong>Dữ liệu nhạy cảm:</strong> hệ thống KHÔNG lưu lý do vắng (chỉ lưu số buổi). Ghi
            chú can thiệp của Cố vấn học tập có thể chứa thông tin sức khỏe — khi đó được đánh dấu
            “nhạy cảm”, chỉ Cố vấn học tập phụ trách trực tiếp xem được; quản trị viên và các trang
            tổng hợp không hiển thị nội dung này.
          </p>
        </Section>

        <Section n={3} title="Mục đích xử lý">
          <p>
            Phát hiện sớm dấu hiệu rủi ro học tập và hỗ trợ Cố vấn học tập can thiệp kịp thời. Cảnh
            báo chỉ mang tính tham khảo, không phải quyết định học vụ chính thức; hệ thống không tự
            thay đổi tình trạng học vụ của sinh viên.
          </p>
          <p>
            Dữ liệu KHÔNG được dùng cho mục đích khác: không chia sẻ cho bên thứ ba ngoài phạm vi
            đào tạo, không dùng cho quảng cáo hay thương mại.
          </p>
        </Section>

        <Section n={4} title="Căn cứ xử lý dữ liệu">
          <p>Theo quy chế đào tạo đã công bố của nhà trường.</p>
        </Section>

        <Section n={5} title="Thời gian lưu trữ">
          <p>
            Dữ liệu học tập và file dữ liệu gốc được lưu theo quy định lưu trữ hồ sơ đào tạo của nhà
            trường: {env.PRIVACY_RETENTION ?? TO_CONFIRM}. File gốc các lô nhập được giữ tối thiểu 1
            học kỳ và chỉ quản trị viên tải được.
          </p>
        </Section>

        <Section n={6} title="Quyền của sinh viên">
          <ul className="list-disc pl-6">
            <li>Xem dữ liệu học tập và cảnh báo của chính mình sau khi đăng nhập.</li>
            <li>
              Yêu cầu chỉnh sửa dữ liệu sai thông qua phòng đào tạo (sinh viên không tự sửa trong hệ
              thống).
            </li>
            <li>Khiếu nại về việc xử lý dữ liệu cá nhân qua bộ phận phụ trách nêu ở mục 1.</li>
          </ul>
        </Section>

        <Section n={7} title="Biện pháp bảo mật áp dụng">
          <ul className="list-disc pl-6">
            <li>Mã hóa đường truyền (TLS) giữa trình duyệt, máy chủ ứng dụng và cơ sở dữ liệu.</li>
            <li>
              Phân quyền theo phạm vi: sinh viên chỉ xem dữ liệu của mình; Cố vấn học tập chỉ xem
              sinh viên thuộc lớp mình phụ trách; quản trị viên chỉ giám sát.
            </li>
            <li>
              Nhật ký kiểm toán chỉ ghi thêm, không sửa hay xóa được — ghi lại các thao tác quan
              trọng, kể cả việc xem hồ sơ sinh viên.
            </li>
            <li>Mật khẩu được băm, phiên đăng nhập có thời hạn, giới hạn số lần đăng nhập sai.</li>
          </ul>
        </Section>

        <footer className="border-t pt-4 text-sm">
          <Link href="/" className="text-primary hover:underline">
            Về trang chính
          </Link>
        </footer>
      </article>
    </main>
  );
}
