import type { Metadata } from 'next';
import { CreateTermDialog } from '@/components/admin/create-term-dialog';
import { TermsTable } from '@/components/admin/terms-table';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { HELP_LINKS } from '@/lib/help-links';
import { toVnIsoDate } from '@/lib/dates';
import { getEnv } from '@/lib/env';
import { listTerms } from '@/modules/admin/services/term.service';

export const metadata: Metadata = { title: 'Học kỳ' };

/** Năm học bắt đầu khoảng tháng 8: trước tháng 8 thì năm học hiện tại bắt đầu từ năm trước. */
function currentAcademicStartYear(): number {
  const [year, month] = toVnIsoDate(new Date()).split('-').map(Number);
  return (month ?? 1) >= 8 ? (year ?? 2000) : (year ?? 2001) - 1;
}

export default async function TermsPage() {
  await requireUser([UserRole.ADMIN]);
  const terms = await listTerms();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        helpHref={HELP_LINKS.terms}
        title="Học kỳ"
        description="Mỗi thời điểm chỉ có 1 học kỳ hiện tại. Chốt học kỳ sau khi đã nhập kết quả học phần — hệ thống chạy đánh giá lần cuối rồi mới chốt."
        action={<CreateTermDialog defaultStartYear={currentAcademicStartYear()} />}
      />
      <Card className="shadow-sm">
        <CardContent>
          <TermsTable terms={terms} canChooseAsOf={getEnv().DEMO_MODE} />
        </CardContent>
      </Card>
    </div>
  );
}
