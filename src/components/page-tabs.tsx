import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface PageTab {
  key: string;
  label: string;
  href: string;
  /** Số hiện cạnh nhãn; 0 hoặc không truyền thì ẩn. */
  count?: number;
}

/** Tab cấp trang theo URL (giữ được khi tải lại, chia sẻ link): gạch chân tab đang chọn. */
export function PageTabs({ tabs, active }: { tabs: PageTab[]; active: string }) {
  return (
    <nav aria-label="Các phần của trang" className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => {
        const current = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
              current
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 tabular-nums dark:bg-amber-950 dark:text-amber-300">
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
