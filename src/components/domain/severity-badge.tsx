import { Badge } from '@/components/ui/badge';
import { Severity } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** Class màu khai báo 1 lần trong globals.css (@utility severity-*). */
const SEVERITY_CLASS: Record<Severity, string> = {
  [Severity.LOW]: 'severity-low',
  [Severity.MEDIUM]: 'severity-medium',
  [Severity.HIGH]: 'severity-high',
  [Severity.CRITICAL]: 'severity-critical',
};

/** Luôn kèm nhãn chữ — không dùng màu làm phương tiện duy nhất. */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge variant="unstyled" className={cn(SEVERITY_CLASS[severity], className)}>
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
