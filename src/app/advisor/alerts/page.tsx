import type { Metadata } from 'next';
import { Inbox } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ActiveAlertFilters } from '@/components/alerts/active-alert-filters';
import { AcknowledgeLowButton } from '@/components/alerts/acknowledge-low-button';
import { AlertListFilter } from '@/components/alerts/alert-list-filter';
import { AlertsTable } from '@/components/alerts/alerts-table';
import { ExportAlertsButton } from '@/components/alerts/export-alerts-button';
import { TermFilter } from '@/components/alerts/term-filter';
import { DataPagination } from '@/components/data-table/data-pagination';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertStatus, Severity, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { parseListParams, type RawSearchParams, withParams } from '@/lib/list-params';
import { getAdvisorClasses } from '@/modules/alerts/services/advisor-dashboard.service';
import {
  ALERT_DEFAULT_SORT,
  ALERT_SORT_KEYS,
  listAdvisorAlerts,
} from '@/modules/alerts/services/alert-query.service';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { alertExtraFilterSchema } from '@/modules/alerts/validators/alert-list';

export const metadata: Metadata = { title: 'Cảnh báo cần xử lý' };

/**
 * Danh sách cảnh báo của Cố vấn học tập (docs/rules/07): mức cao trên cùng, phân trang ở server,
 * tìm / lọc trên URL. Phạm vi suy ra qua lớp phụ trách (docs/rules/06).
 */
export default async function AdvisorAlertsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireUser([UserRole.ADVISOR]);
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === 'string' ? params[k] : undefined);
  const extra = alertExtraFilterSchema.parse(params);
  const list = parseListParams(params, ALERT_SORT_KEYS, ALERT_DEFAULT_SORT);
  const terms = await listTermOptions();
  const term = pickTerm(terms, str('term'));
  const all = str('view') === 'all';
  const [result, classes] = term
    ? await Promise.all([
        listAdvisorAlerts(user.userId, term.termId, all ? 'ALL' : 'TODO', extra, list),
        getAdvisorClasses(user.userId, term.termId),
      ])
    : [{ items: [], total: 0, page: 1, size: list.size }, []];
  const lowPending = result.items.some(
    (a) =>
      a.severity === Severity.LOW &&
      (a.status === AlertStatus.OPEN || a.status === AlertStatus.REOPENED),
  );
  const tab = (view: string | null) =>
    `/advisor/alerts${withParams(params, { view, page: null, alert: null })}`;
  const filtered = Object.values(extra).some((v) => v !== undefined);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Cảnh báo cần xử lý"
        description="Mức cao trên cùng. Bấm Xem để mở chi tiết, xác nhận và ghi can thiệp."
        action={term ? <ExportAlertsButton basePath="/api/alerts/export" params={params} /> : null}
      />
      <ReferenceOnlyNotice />
      <div className="flex flex-wrap items-center gap-3">
        {term && <TermFilter terms={terms} value={term.termId} />}
        <div className="flex gap-1">
          <Button asChild size="sm" variant={all ? 'outline' : 'default'}>
            <Link href={tab(null)}>Cần xử lý</Link>
          </Button>
          <Button asChild size="sm" variant={all ? 'default' : 'outline'}>
            <Link href={tab('all')}>Tất cả</Link>
          </Button>
        </div>
        {term && lowPending && <AcknowledgeLowButton termId={term.termId} />}
      </div>
      <Suspense>
        <AlertListFilter classes={classes.map((c) => c.classId)} />
      </Suspense>
      <ActiveAlertFilters basePath="/advisor/alerts" params={params} extra={extra} />
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <AlertsTable
            items={result.items}
            profileBase="/advisor/students"
            serverSort={{ sort: list.sort, dir: list.dir }}
            emptyMessage={
              filtered ? (
                'Không có cảnh báo nào khớp bộ lọc.'
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="Chưa có sinh viên nào cần chú ý"
                  description="Cảnh báo xuất hiện sau mỗi lần hệ thống đánh giá dữ liệu học tập của lớp bạn."
                />
              )
            }
          />
          <DataPagination
            basePath="/advisor/alerts"
            params={params}
            total={result.total}
            page={result.page}
            size={result.size}
            unit="cảnh báo"
          />
        </CardContent>
      </Card>
    </div>
  );
}
