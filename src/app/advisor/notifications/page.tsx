import type { Metadata } from 'next';
import { BellOff } from 'lucide-react';
import Link from 'next/link';
import { MarkAllReadButton, NotificationList } from '@/components/alerts/notification-list';
import { DataPagination } from '@/components/data-table/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { parseListParams, type RawSearchParams, withParams } from '@/lib/list-params';
import { listInAppNotificationsPaged } from '@/modules/alerts/services/notification.service';

export const metadata: Metadata = { title: 'Thông báo' };

/** Thông báo trong ứng dụng của Cố vấn học tập (chỉ của chính mình — docs/rules/06, 07). */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireUser([UserRole.ADVISOR]);
  const params = await searchParams;
  const unreadOnly = params.filter === 'unread';
  const result = await listInAppNotificationsPaged(
    user.userId,
    unreadOnly,
    parseListParams(params),
  );
  const tab = (filter: string | null) =>
    `/advisor/notifications${withParams(params, { filter, page: null })}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Thông báo"
        description="Hệ thống báo khi lớp bạn có cảnh báo mới, cảnh báo mở lại hoặc tăng mức. Bấm để mở cảnh báo."
        action={<MarkAllReadButton disabled={result.unread === 0} />}
      />
      <div className="flex gap-1">
        <Button asChild size="sm" variant={unreadOnly ? 'outline' : 'default'}>
          <Link href={tab(null)}>Tất cả</Link>
        </Button>
        <Button asChild size="sm" variant={unreadOnly ? 'default' : 'outline'}>
          <Link href={tab('unread')}>Chưa đọc ({result.unread})</Link>
        </Button>
      </div>
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          {result.items.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title={unreadOnly ? 'Bạn đã đọc hết thông báo' : 'Chưa có thông báo nào'}
              description="Thông báo xuất hiện sau mỗi lần hệ thống đánh giá dữ liệu học tập của lớp bạn."
            />
          ) : (
            <NotificationList items={result.items} />
          )}
          <DataPagination
            basePath="/advisor/notifications"
            params={params}
            total={result.total}
            page={result.page}
            size={result.size}
            unit="thông báo"
          />
        </CardContent>
      </Card>
    </div>
  );
}
