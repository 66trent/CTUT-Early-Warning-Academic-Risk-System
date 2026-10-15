import { Info } from 'lucide-react';
import { REFERENCE_ONLY_NOTICE } from '@/lib/labels';

/** Dòng cố định ở MỌI nơi hiển thị cảnh báo — không được ẩn/thu gọn (docs/rules/03). */
export function ReferenceOnlyNotice() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Info aria-hidden className="size-4 shrink-0" />
      {REFERENCE_ONLY_NOTICE}
    </p>
  );
}
