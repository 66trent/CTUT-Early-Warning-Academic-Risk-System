'use client';

import { RotateCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Trang lỗi thân thiện cho error.tsx — KHÔNG hiện nội dung lỗi kỹ thuật (docs/rules/06), chỉ mã
 * tra cứu `digest` để đối chiếu log máy chủ.
 */
export function RouteError({
  error,
  reset,
  homeHref,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <TriangleAlert aria-hidden className="size-6 text-destructive" />
      </span>
      <h1 className="text-xl">Không tải được trang này</h1>
      <p className="text-muted-foreground">
        Hệ thống gặp sự cố tạm thời (có thể do mất kết nối cơ sở dữ liệu). Dữ liệu của bạn không bị
        thay đổi. Hãy thử lại sau ít phút; nếu vẫn lỗi, báo quản trị viên kèm mã bên dưới.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">Mã lỗi: {error.digest}</p>
      )}
      <div className="mt-2 flex gap-2">
        <Button onClick={reset}>
          <RotateCw aria-hidden />
          Thử lại
        </Button>
        <Button asChild variant="outline">
          <Link href={homeHref}>Về trang chính</Link>
        </Button>
      </div>
    </div>
  );
}
