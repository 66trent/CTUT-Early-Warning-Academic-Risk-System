import { Skeleton } from '@/components/ui/skeleton';

/**
 * Khung chờ khi trang đang tải (loading.tsx): tiêu đề, hàng thẻ số và bảng — cùng bố cục với trang
 * thật để nội dung không nhảy khi hiện ra (docs/rules/07).
 */
export function PageSkeleton({ cards = 4, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-6"
      role="status"
      aria-live="polite"
      aria-label="Đang tải trang"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      {cards > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-9 w-full max-w-sm" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <span className="sr-only">Đang tải…</span>
    </div>
  );
}
