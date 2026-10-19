import type { Metadata } from 'next';
import { ShieldCheck, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { DepartmentFilter } from '@/components/admin/department-filter';
import { DataPagination } from '@/components/data-table/data-pagination';
import { ActiveAlertFilters } from '@/components/alerts/active-alert-filters';
import { AlertListFilter } from '@/components/alerts/alert-list-filter';
import { AlertsTable } from '@/components/alerts/alerts-table';
import { ExportAlertsButton } from '@/components/alerts/export-alerts-button';
import { TermFilter } from '@/components/alerts/term-filter';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { HELP_LINKS } from '@/lib/help-links';
import { parseListParams, type RawSearchParams } from '@/lib/list-params';
import { listDepartments } from '@/modules/admin/services/class.service';
import {
  ALERT_DEFAULT_SORT,
  ALERT_SORT_KEYS,
  listAdminAlerts,
} from '@/modules/alerts/services/alert-query.service';
import { alertExtraFilterSchema } from '@/modules/alerts/validators/alert-list';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';

export const metadata: Metadata = { title: 'Cảnh báo sớm' };

/** Admin giám sát — CHỈ ĐỌC, không xử lý cảnh báo (docs/rules/00). */
export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === 'string' ? params[k] : undefined);
  const list = parseListParams(params, ALERT_SORT_KEYS, ALERT_DEFAULT_SORT);
  const [terms, departments] = await Promise.all([listTermOptions(), listDepartments()]);
  const term = pickTerm(terms, str('term'));
  const department = departments.find((d) => d.departmentId === str('department')) ?? null;
  const noAdvisor = str('filter') === 'no-advisor';
  const extra = alertExtraFilterSchema.parse(params);
  const result = term
    ? await listAdminAlerts(
        term.termId,
        noAdvisor ? 'NO_ADVISOR' : 'ALL',
        department?.departmentId ?? null,
        list,
        extra,
      )
    : { items: [], total: 0, page: 1, size: list.size };
  const link = (filter: string | null) => {
    const query = new URLSearchParams();
    if (term) query.set('term', term.termId);
    if (department) query.set('department', department.departmentId);
    if (filter) query.set('filter', filter);
    return `/admin/alerts?${query.toString()}`;
  };
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        helpHref={HELP_LINKS.alerts}
        title="Cảnh báo sớm"
        description="Xem toàn bộ cảnh báo ở chế độ chỉ đọc. Cố vấn học tập phụ trách lớp là người xử lý."
        action={term ? <ExportAlertsButton basePath="/api/alerts/export" params={params} /> : null}
      />
      <ReferenceOnlyNotice />
      <div className="flex flex-wrap items-center gap-3">
        {term && <TermFilter terms={terms} value={term.termId} />}
        <DepartmentFilter departments={departments} value={department?.departmentId ?? null} />
        <div className="flex gap-1">
          <Button asChild size="sm" variant={noAdvisor ? 'outline' : 'default'}>
            <Link href={link(null)}>Tất cả</Link>
          </Button>
          <Button asChild size="sm" variant={noAdvisor ? 'default' : 'outline'}>
            <Link href={link('no-advisor')}>Chưa có Cố vấn học tập phụ trách</Link>
          </Button>
        </div>
      </div>
      <Suspense>
        <AlertListFilter classes={[]} />
      </Suspense>
      <ActiveAlertFilters basePath="/admin/alerts" params={params} extra={extra} />
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <AlertsTable
            items={result.items}
            serverSort={{ sort: list.sort, dir: list.dir }}
            profileBase="/admin/students"
            showAdvisor
            emptyMessage={
              noAdvisor ? (
                <EmptyState
                  icon={UserCheck}
                  title="Mọi cảnh báo đang mở đều đã có Cố vấn học tập phụ trách"
                />
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="Chưa có cảnh báo nào trong học kỳ này"
                  description="Cảnh báo xuất hiện sau khi nạp dữ liệu học tập và chạy đánh giá."
                  action={{ href: '/admin/evaluations', label: 'Chạy đánh giá' }}
                />
              )
            }
          />
          <DataPagination
            basePath="/admin/alerts"
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
