import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AlertStatus } from '@/db/enums';
import { ALERT_STATUS_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

const STATUS_CLASS: Record<AlertStatus, string> = {
  [AlertStatus.OPEN]: 'alert-status-open',
  [AlertStatus.ACKNOWLEDGED]: 'alert-status-acknowledged',
  [AlertStatus.IN_PROGRESS]: 'alert-status-in-progress',
  [AlertStatus.REOPENED]: 'alert-status-reopened',
  [AlertStatus.RESOLVED]: 'alert-status-resolved',
  [AlertStatus.DISMISSED]: 'alert-status-closed',
  [AlertStatus.INVALIDATED]: 'alert-status-closed',
};

export function AlertStatusBadge({
  status,
  className,
}: {
  status: AlertStatus;
  className?: string;
}) {
  return (
    <Badge variant="unstyled" className={cn(STATUS_CLASS[status], className)}>
      {status === AlertStatus.RESOLVED && <Check aria-hidden />}
      {ALERT_STATUS_LABELS[status]}
    </Badge>
  );
}
