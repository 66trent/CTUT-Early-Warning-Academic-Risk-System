import { CircleCheck, Clock, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EvaluationRunStatus } from '@/db/enums';
import { RUN_STATUS_LABELS } from '@/modules/rule-engine/labels';

const ICONS = {
  [EvaluationRunStatus.QUEUED]: Clock,
  [EvaluationRunStatus.RUNNING]: Loader2,
  [EvaluationRunStatus.COMPLETED]: CircleCheck,
  [EvaluationRunStatus.FAILED]: XCircle,
} as const;

/** Trạng thái lần chạy — luôn có nhãn chữ, không dùng màu làm thông tin duy nhất. */
export function RunStatusBadge({ status }: { status: EvaluationRunStatus }) {
  const Icon = ICONS[status];
  return (
    <Badge
      variant="outline"
      className={status === EvaluationRunStatus.FAILED ? 'gap-1 text-destructive' : 'gap-1'}
    >
      <Icon aria-hidden className={Icon === Loader2 ? 'animate-spin' : undefined} />
      {RUN_STATUS_LABELS[status]}
    </Badge>
  );
}
