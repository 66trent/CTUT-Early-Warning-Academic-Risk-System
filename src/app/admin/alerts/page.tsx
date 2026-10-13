import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertsTable } from '@/components/alerts/alerts-table';
import { TermFilter } from '@/components/alerts/term-filter';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { listAdminAlerts } from '@/modules/alerts/services/alert-query.service';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';

export const metadata: Metadata = { title: 'Cảnh báo sớm' };

/** Admin giám sát — CHỈ ĐỌC, không xử lý cảnh báo (docs/rules/00). */
export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; filter?: string }>;
}) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const terms = await listTermOptions();
  const term = pickTerm(terms, params.term);
  const noAdvisor = params.filter === 'no-advisor';
  const items = term ? await listAdminAlerts(term.termId, noAdvisor ? 'NO_ADVISOR' : 'ALL') : [];
  const link = (filter: string | null) => {
    const query = new URLSearchParams();
    if (term) query.set('term', term.termId);
    if (filter) query.set('filter', filter);
    return `/admin/alerts?${query.toString()}`;
  };
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Cảnh báo sớm"
        description="Xem toàn bộ cảnh báo ở chế độ chỉ đọc. Cố vấn học tập phụ trách lớp là người xử lý."
      />
      <ReferenceOnlyNotice />
      <div className="flex flex-wrap items-center gap-3">
        {term && <TermFilter terms={terms} value={term.termId} />}
        <div className="flex gap-1">
          <Button asChild size="sm" variant={noAdvisor ? 'outline' : 'default'}>
            <Link href={link(null)}>Tất cả</Link>
          </Button>
          <Button asChild size="sm" variant={noAdvisor ? 'default' : 'outline'}>
            <Link href={link('no-advisor')}>Chưa có Cố vấn học tập phụ trách</Link>
          </Button>
        </div>
      </div>
      <Card className="shadow-sm">
        <CardContent>
          <AlertsTable
            items={items}
            profileBase="/admin/students"
            showAdvisor
            emptyMessage={
              noAdvisor
                ? 'Mọi cảnh báo đang mở đều đã có Cố vấn học tập phụ trách.'
                : 'Chưa có cảnh báo nào trong học kỳ này.'
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
