import type { Severity } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { SEVERITY_CLASS, SEVERITY_SHORT } from './severity-badge';

/** Cụm số theo mức (VD "RC 3 · C 6"), chỉ hiện mức có số; không có gì thì ghi "Không có". */
export function SeverityCounts({
  items,
  className,
}: {
  items: { severity: Severity; count: number }[];
  className?: string;
}) {
  const shown = items.filter((i) => i.count > 0);
  if (shown.length === 0) return <span className="text-muted-foreground">Không có</span>;
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {shown.map((i) => (
        <span
          key={i.severity}
          title={SEVERITY_LABELS[i.severity]}
          aria-label={`${SEVERITY_LABELS[i.severity]}: ${i.count}`}
          className={cn(
            'rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums',
            SEVERITY_CLASS[i.severity],
          )}
        >
          {SEVERITY_SHORT[i.severity]} {i.count}
        </span>
      ))}
    </span>
  );
}
