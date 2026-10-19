import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Trang "không tìm thấy" — dùng cho not-found.tsx gốc và từng khu vực vai trò. */
export function NotFoundView({ homeHref = '/' }: { homeHref?: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FileQuestion aria-hidden className="size-6 text-muted-foreground" />
      </span>
      <h1 className="text-xl">Không tìm thấy nội dung</h1>
      <p className="text-muted-foreground">
        Đường dẫn không đúng, hoặc nội dung đã bị xóa, hoặc bạn không có quyền xem nội dung này.
      </p>
      <Button asChild variant="outline" className="mt-2">
        <Link href={homeHref}>Về trang chính</Link>
      </Button>
    </div>
  );
}
