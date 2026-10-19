'use client';

import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { useOpenNotification } from './notification-list';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatVnDateTime } from '@/lib/dates';
import {
  listMyNotificationsAction,
  markNotificationsReadAction,
} from '@/modules/alerts/actions/alert.actions';
import type { InAppNotificationDto } from '@/modules/alerts/services/notification.service';

/** Chuông thông báo trong ứng dụng của Cố vấn học tập — số chưa đọc, mở ra là đánh dấu đã đọc. */
export function NotificationBell() {
  const router = useRouter();
  const openNotification = useOpenNotification();
  const [data, setData] = useState<{ items: InAppNotificationDto[]; unread: number }>({
    items: [],
    unread: 0,
  });

  useEffect(() => {
    const load = () =>
      void listMyNotificationsAction().then((r) => {
        if (r.ok) setData(r.data);
      });
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Thông báo${data.unread ? ` (${data.unread} chưa đọc)` : ''}`}
          className="relative"
        >
          <Bell aria-hidden />
          {data.unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
              {data.unread > 99 ? '99+' : data.unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          Thông báo
          {data.unread > 0 && (
            <button
              type="button"
              className="text-xs font-normal text-primary hover:underline"
              onClick={() =>
                void markNotificationsReadAction().then(() =>
                  setData((d) => ({
                    unread: 0,
                    items: d.items.map((n) => ({ ...n, read: true })),
                  })),
                )
              }
            >
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {data.items.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">Chưa có thông báo nào.</p>
        )}
        {data.items.map((n) => (
          <DropdownMenuItem
            key={n.notificationId}
            className={
              n.read
                ? 'flex flex-col items-start gap-1'
                : 'flex flex-col items-start gap-1 bg-primary-soft'
            }
            onSelect={() => {
              if (!n.read) {
                setData((d) => ({
                  unread: Math.max(0, d.unread - 1),
                  items: d.items.map((x) =>
                    x.notificationId === n.notificationId ? { ...x, read: true } : x,
                  ),
                }));
              }
              openNotification(n);
            }}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <SeverityBadge severity={n.severity} />
              {n.studentName}
            </span>
            <span className="text-xs text-muted-foreground">
              {n.title} · {formatVnDateTime(n.createdAt)}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/advisor/notifications')}>
          Xem tất cả thông báo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
