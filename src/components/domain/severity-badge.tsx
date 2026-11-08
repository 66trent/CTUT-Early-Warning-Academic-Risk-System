import { Badge } from '@/components/ui/badge';
import { Severity } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** Class màu khai báo 1 lần trong globals.css (@utility severity-*). */
export const SEVERITY_CLASS: Record<Severity, string> = {
  [Severity.LOW]: 'severity-low',
  [Severity.MEDIUM]: 'severity-medium',
  [Severity.HIGH]: 'severity-high',
  [Severity.CRITICAL]: 'severity-critical',
};

/** Chữ viết tắt mức cho ô hẹp — luôn kèm chữ, không chỉ màu (docs/rules/07). */
export const SEVERITY_SHORT: Record<Severity, string> = {
  [Severity.LOW]: 'T',
  [Severity.MEDIUM]: 'TB',
  [Severity.HIGH]: 'C',
  [Severity.CRITICAL]: 'RC',
};

/** Vạch màu đầu dòng (bảng cảnh báo). */
export const SEVERITY_ROW_CLASS: Record<Severity, string> = {
  [Severity.LOW]: 'row-severity-low',
  [Severity.MEDIUM]: 'row-severity-medium',
  [Severity.HIGH]: 'row-severity-high',
  [Severity.CRITICAL]: 'row-severity-critical',
};

/** Luôn kèm nhãn chữ — không dùng màu làm phương tiện duy nhất. */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge variant="unstyled" className={cn(SEVERITY_CLASS[severity], className)}>
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
