import { CircleCheck } from 'lucide-react';
import { formatVnDateTime } from '@/lib/dates';

/**
 * Lần đánh giá cả học kỳ gần nhất không còn dấu hiệu nào — hệ thống KHÔNG tự đóng cảnh báo,
 * Cố vấn học tập cân nhắc chuyển "Đã giải quyết" (docs/rules/08).
 */
export function SignalsClearedNote({ at, compact = false }: { at?: string; compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CircleCheck aria-hidden className="size-3.5" />
        Lần đánh giá gần nhất không còn dấu hiệu
      </span>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm">
      <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>
        Lần đánh giá cả học kỳ gần nhất{at ? ` (${formatVnDateTime(at)})` : ''} không còn dấu hiệu
        nào. Cảnh báo vẫn mở — Cố vấn học tập cân nhắc chuyển &quot;Đã giải quyết&quot; nếu sinh
        viên đã ổn định. Dấu hiệu bên dưới là của lần có dấu hiệu gần nhất.
      </span>
    </p>
  );
}
