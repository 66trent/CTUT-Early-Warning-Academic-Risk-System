'use client';

import { Bell, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { toast } from '@/lib/notify';
import {
  type BellDto,
  listMyBellAction,
  markUpdatesReadAction,
} from '@/modules/alerts/actions/alert.actions';
import type { InAppNotificationDto } from '@/modules/alerts/services/notification.service';
import type { UpdateNotificationDto } from '@/modules/alerts/services/update-notification.service';

/** Chuông tự tải lại sau mỗi khoảng này + khi quay lại tab (người dùng chốt 2026-11-08). */
const POLL_MS = 15_000;
/** Toast "có cập nhật mới" đứng lâu đủ để bấm "Tải lại". */
const TOAST_MS = 20_000;

type Item =
  ({ kind: 'ALERT' } & InAppNotificationDto) | ({ kind: 'UPDATE' } & UpdateNotificationDto);

const keyOf = (i: Item) => (i.kind === 'ALERT' ? `a-${i.notificationId}` : `u-${i.id}`);

function merge(data: BellDto): Item[] {
  return [
    ...data.alerts.map((n) => ({ kind: 'ALERT' as const, ...n })),
    ...data.updates.map((n) => ({ kind: 'UPDATE' as const, ...n })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
}

/**
 * Chuông thông báo của Admin và Cố vấn học tập: cảnh báo (CVHT) + "dữ liệu vừa cập nhật / đánh giá đã
 * cập nhật" (cả hai). Có thông báo mới khi đang mở trang → hiện "Tải lại" để thấy số mới.
 */
export function NotificationBell({ allHref }: { allHref: string }) {
  const router = useRouter();
  const openNotification = useOpenNotification();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(() => {
    void listMyBellAction().then((r) => {
      if (!r.ok) return;
      const merged = merge(r.data);
      const fresh = seen.current
        ? merged.filter((i) => !i.read && !seen.current?.has(keyOf(i)))
        : [];
      seen.current = new Set(merged.map(keyOf));
      setItems(merged);
      setUnread(r.data.unread);
      const latest = fresh[0];
      if (latest) {
        toast(latest.kind === 'UPDATE' ? latest.title : `${latest.title}: ${latest.studentName}`, {
          description: latest.kind === 'UPDATE' ? latest.body : undefined,
          action: { label: 'Tải lại', onClick: () => router.refresh() },
          duration: TOAST_MS,
        });
      }
    });
  }, [router]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  function markRead(item: Item) {
    if (item.read) return;
    setUnread((u) => Math.max(0, u - 1));
    setItems((list) => list.map((x) => (keyOf(x) === keyOf(item) ? { ...x, read: true } : x)));
    // Thông báo cảnh báo: `openNotification` tự đánh dấu đã đọc.
    if (item.kind === 'UPDATE') void markUpdatesReadAction({ id: item.id });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ''}`}
          className="relative"
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          Thông báo
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-normal text-primary hover:underline"
              onClick={() =>
                void markUpdatesReadAction({}).then(() => {
                  setUnread(0);
                  setItems((list) => list.map((n) => ({ ...n, read: true })));
                })
              }
            >
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">Chưa có thông báo nào.</p>
        )}
        {items.map((n) => (
          <DropdownMenuItem
            key={keyOf(n)}
            className={
              n.read
                ? 'flex flex-col items-start gap-1'
                : 'flex flex-col items-start gap-1 bg-primary-soft'
            }
            onSelect={() => {
              markRead(n);
              if (n.kind === 'UPDATE') router.push(n.link);
              else openNotification(n);
            }}
          >
            {n.kind === 'UPDATE' ? (
              <>
                <span className="flex items-start gap-2 text-sm font-medium">
                  <RefreshCw className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {n.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {n.body} · {formatVnDateTime(n.createdAt)}
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <SeverityBadge severity={n.severity} />
                  {n.studentName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {n.title} · {formatVnDateTime(n.createdAt)}
                </span>
              </>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(allHref)}>
          {allHref.startsWith('/admin') ? 'Xem các lần đánh giá' : 'Xem tất cả thông báo cảnh báo'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
