import { CircleCheck, CircleDashed, Clock, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ImportBatchStatus } from '@/db/enums';
import { cn } from '@/lib/utils';
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

const BUSY = 'border-transparent bg-primary-soft text-primary';
const MUTED = 'border-border bg-transparent text-muted-foreground';

/** Màu theo việc cần làm: chờ xác nhận hổ phách, bị từ chối đỏ, đã xong trung tính. */
const TONES: Record<ImportBatchStatus, string> = {
  [ImportBatchStatus.UPLOADING]: BUSY,
  [ImportBatchStatus.VALIDATING]: BUSY,
  [ImportBatchStatus.LOADED]: BUSY,
  [ImportBatchStatus.STAGED]:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  [ImportBatchStatus.REJECTED]:
    'border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  [ImportBatchStatus.RECONCILED]: 'border-border bg-transparent text-foreground',
  [ImportBatchStatus.DISCARDED]: MUTED,
  [ImportBatchStatus.ROLLED_BACK]: MUTED,
};

/** Trạng thái đợt nhập — luôn có nhãn chữ, không dùng màu làm thông tin duy nhất. */
export function BatchStatusBadge({ status }: { status: ImportBatchStatus }) {
  const Icon = ICONS[status];
  return (
    <Badge variant="unstyled" className={cn('gap-1', TONES[status])}>
      <Icon aria-hidden className={Icon === Loader2 ? 'animate-spin' : undefined} />
      {BATCH_STATUS_LABELS[status]}
    </Badge>
  );
}
