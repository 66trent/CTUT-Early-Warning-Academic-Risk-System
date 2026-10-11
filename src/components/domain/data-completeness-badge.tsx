import { Circle, CircleDashed, Contrast } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DataCompletenessLevel } from '@/db/enums';
import { DATA_COMPLETENESS_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

/**
 * Badge viền slate, phân biệt bằng icon/nét viền — KHÔNG dùng màu (tránh nhầm với Severity).
 * FULL: tròn đầy · PARTIAL: tròn nửa · INSUFFICIENT: viền nét đứt.
 */
export function DataCompletenessBadge({
  level,
  className,
}: {
  level: DataCompletenessLevel;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-slate-400 text-slate-700 dark:border-slate-500 dark:text-slate-200',
        level === DataCompletenessLevel.INSUFFICIENT && 'border-dashed',
        className,
      )}
    >
      {level === DataCompletenessLevel.FULL && <Circle aria-hidden className="fill-current" />}
      {level === DataCompletenessLevel.PARTIAL && <Contrast aria-hidden />}
      {level === DataCompletenessLevel.INSUFFICIENT && <CircleDashed aria-hidden />}
      {DATA_COMPLETENESS_LABELS[level]}
    </Badge>
  );
}
