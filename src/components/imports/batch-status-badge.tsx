import { CircleCheck, CircleDashed, Clock, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ImportBatchStatus } from '@/db/enums';
import { BATCH_STATUS_LABELS } from '@/modules/data-import/labels';

const ICONS = {
  [ImportBatchStatus.UPLOADING]: Loader2,
  [ImportBatchStatus.VALIDATING]: Loader2,
  [ImportBatchStatus.STAGED]: Clock,
  [ImportBatchStatus.LOADED]: Loader2,
  [ImportBatchStatus.RECONCILED]: CircleCheck,
  [ImportBatchStatus.REJECTED]: XCircle,
  [ImportBatchStatus.DISCARDED]: CircleDashed,
  [ImportBatchStatus.ROLLED_BACK]: RotateCcw,
} as const;

/** Trạng thái lô — luôn có nhãn chữ, không dùng màu làm thông tin duy nhất. */
export function BatchStatusBadge({ status }: { status: ImportBatchStatus }) {
  const Icon = ICONS[status];
  const muted =
    status === ImportBatchStatus.DISCARDED ||
    status === ImportBatchStatus.ROLLED_BACK ||
    status === ImportBatchStatus.REJECTED;
  return (
    <Badge variant="outline" className={muted ? 'gap-1 text-muted-foreground' : 'gap-1'}>
      <Icon aria-hidden className={Icon === Loader2 ? 'animate-spin' : undefined} />
      {BATCH_STATUS_LABELS[status]}
    </Badge>
  );
}
