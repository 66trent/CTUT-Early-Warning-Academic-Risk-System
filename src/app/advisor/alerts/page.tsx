import type { Metadata } from 'next';
import Link from 'next/link';
import { ActiveAlertFilters } from '@/components/alerts/active-alert-filters';
import { AcknowledgeLowButton } from '@/components/alerts/acknowledge-low-button';
import { AlertsTable } from '@/components/alerts/alerts-table';
import { TermFilter } from '@/components/alerts/term-filter';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertStatus, Severity, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { listAdvisorAlerts } from '@/modules/alerts/services/alert-query.service';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { alertExtraFilterSchema } from '@/modules/alerts/validators/alert-list';
import type { RawSearchParams } from '@/lib/list-params';

export const metadata: Metadata = { title: 'Cảnh báo cần xử lý' };

interface AdvisorPageProps {
  searchParams: Promise<RawSearchParams>;
}

/** Màn hình mặc định của Cố vấn học tập: cảnh báo cần hành động, mức cao trên cùng (docs/rules/07). */
export default async function AdvisorHomePage({ searchParams }: AdvisorPageProps) {
  const user = await requireUser([UserRole.ADVISOR]);
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === 'string' ? params[k] : undefined);
  const extra = alertExtraFilterSchema.parse(params);
  const terms = await listTermOptions();
  const term = pickTerm(terms, str('term'));
  const all = str('view') === 'all';
  const items = term
    ? await listAdvisorAlerts(user.userId, term.termId, all ? 'ALL' : 'TODO', extra)
    : [];
  const lowPending = items.some(
    (a) =>
      a.severity === Severity.LOW &&
      (a.status === AlertStatus.OPEN || a.status === AlertStatus.REOPENED),
  );
  const tab = (view: string | null) =>
    `/advisor/alerts?${new URLSearchParams({ ...(term ? { term: term.termId } : {}), ...(view ? { view } : {}) }).toString()}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1>Cảnh báo cần xử lý</h1>
        <div className="mt-1">
          <ReferenceOnlyNotice />
        </div>
      </div>
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
      <ActiveAlertFilters basePath="/advisor/alerts" params={params} extra={extra} />
      <Card className="shadow-sm">
        <CardContent>
          <AlertsTable
            items={items}
            profileBase="/advisor/students"
            emptyMessage="Chưa có sinh viên nào cần chú ý trong học kỳ này."
          />
        </CardContent>
      </Card>
    </div>
  );
}
