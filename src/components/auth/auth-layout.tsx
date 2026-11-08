import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { APP_NAME, UNIVERSITY_NAME } from '@/lib/app-config';

const FACTS = [
  { value: 4, label: 'nguồn dữ liệu' },
  { value: 12, label: 'luật cảnh báo' },
  { value: 3, label: 'vai trò' },
];

/** Bố cục trang đăng nhập/đăng ký: 2 cột trên desktop (docs/rules/03), 1 cột trên mobile. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-center gap-8 bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <span className="flex size-24 items-center justify-center rounded-full bg-white">
          <Image src="/logo.png" alt="" width={88} height={88} priority />
        </span>
        <div className="max-w-md">
          <p className="text-4xl font-bold text-sidebar-accent-foreground">{APP_NAME}</p>
          <p className="mt-2 text-sidebar-muted">{UNIVERSITY_NAME}</p>
          <p className="mt-6 text-base leading-relaxed">
            Hệ thống cảnh báo sớm giúp Cố vấn học tập phát hiện kịp thời sinh viên cần hỗ trợ, dựa
            trên điểm danh, bài kiểm tra trực tuyến và kết quả học tập.
          </p>
        </div>
        <dl className="flex max-w-md gap-10 border-t border-sidebar-border pt-6">
          {FACTS.map((f) => (
            <div key={f.label}>
              <dd className="text-3xl font-bold text-sidebar-accent-foreground tabular-nums">
                {f.value}
              </dd>
              <dt className="mt-1 text-sm text-sidebar-muted">{f.label}</dt>
            </div>
          ))}
        </dl>
      </aside>
      <main className="flex items-center justify-center bg-background p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Image src="/logo.png" alt="" width={48} height={48} priority />
            <div>
              <p className="text-xl font-bold text-accent-strong">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground">{UNIVERSITY_NAME}</p>
            </div>
          </div>
          {children}
          <p className="mt-6 text-center text-sm">
            <Link href="/legal/privacy-policy" className="text-muted-foreground hover:underline">
              Chính sách bảo vệ dữ liệu cá nhân
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
