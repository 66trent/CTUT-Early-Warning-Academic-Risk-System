import Image from 'next/image';
import type { ReactNode } from 'react';
import { APP_NAME, UNIVERSITY_NAME } from '@/lib/app-config';

/** Bố cục trang đăng nhập/đăng ký: 2 cột trên desktop (docs/rules/03), 1 cột trên mobile. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-center gap-6 bg-primary-soft p-12 lg:flex">
        <Image src="/logo.png" alt="" width={96} height={96} priority />
        <div className="max-w-md">
          <p className="text-3xl font-bold text-accent-strong">{APP_NAME}</p>
          <p className="mt-1 text-muted-foreground">{UNIVERSITY_NAME}</p>
          <p className="mt-6 text-base leading-relaxed">
            Hệ thống cảnh báo sớm giúp Cố vấn học tập phát hiện kịp thời sinh viên cần hỗ trợ, dựa
            trên điểm danh, bài kiểm tra trực tuyến và kết quả học tập.
          </p>
        </div>
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
        </div>
      </main>
    </div>
  );
}
