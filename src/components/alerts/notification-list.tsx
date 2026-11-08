'use client';

import { CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { Button } from '@/components/ui/button';
import { formatVnDateTime } from '@/lib/dates';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  markNotificationReadAction,
  markNotificationsReadAction,
} from '@/modules/alerts/actions/alert.actions';
import type { InAppNotificationDto } from '@/modules/alerts/services/notification.service';

/** Mở cảnh báo của thông báo; thông báo chưa đọc được đánh dấu đã đọc trước. */
export function useOpenNotification() {
  const router = useRouter();
  return (n: InAppNotificationDto) => {
    if (!n.read) void markNotificationReadAction({ notificationId: n.notificationId });
    router.push(`/advisor/alerts?alert=${n.alertId}`);
  };
}

/** Danh sách thông báo trên trang `/advisor/notifications`. */
export function NotificationList({ items }: { items: InAppNotificationDto[] }) {
  const open = useOpenNotification();
  return (
    <ul className="divide-y rounded-md border">
      {items.map((n) => (
        <li key={n.notificationId}>
          <button
            type="button"
            onClick={() => open(n)}
            className={cn(
              'flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-secondary',
              !n.read && 'bg-primary-soft',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-1.5 size-2 shrink-0 rounded-full',
                n.read ? 'bg-transparent' : 'bg-primary',
              )}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                <SeverityBadge severity={n.severity} />
                {n.studentName}
                {!n.read && <span className="sr-only">(chưa đọc)</span>}
              </span>
              <span className="text-sm text-muted-foreground">
                {n.title} · {formatVnDateTime(n.createdAt)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Đánh dấu mọi thông báo của mình đã đọc. */
export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const r = await markNotificationsReadAction();
          if (r.ok) {
            toast.success('Đã đánh dấu tất cả là đã đọc');
            router.refresh();
          } else toast.error(r.message);
        })
      }
    >
      <CheckCheck aria-hidden />
      Đánh dấu tất cả đã đọc
    </Button>
  );
}
