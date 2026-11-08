import type { Metadata } from 'next';
import { AdvisorStudentsTable } from '@/components/alerts/advisor-students-table';
import { TermFilter } from '@/components/alerts/term-filter';
import { Card, CardContent } from '@/components/ui/card';
import { SEVERITY_ORDER, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { listAdvisorStudents } from '@/modules/alerts/services/student-profile.service';

export const metadata: Metadata = { title: 'Sinh viên phụ trách' };

/** Sinh viên các lớp do Cố vấn học tập phụ trách (suy ra qua lớp sinh hoạt — docs/rules/06). */
export default async function AdvisorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const user = await requireUser([UserRole.ADVISOR]);
  const terms = await listTermOptions();
  const term = pickTerm(terms, (await searchParams).term);
  const listed = term ? await listAdvisorStudents(user.userId, term.termId) : [];
  // Mức cao lên đầu, sinh viên không có cảnh báo xuống cuối (giữ thứ tự mã số trong cùng nhóm).
  const rank = (s: (typeof listed)[number]) =>
    s.severity ? SEVERITY_ORDER.indexOf(s.severity) : -1;
  const students = [...listed].sort((a, b) => rank(b) - rank(a));
  return (
    <div className="flex flex-col gap-6">
      <h1>Sinh viên phụ trách</h1>
      {term && <TermFilter terms={terms} value={term.termId} />}
      <Card className="shadow-sm">
        <CardContent>
          <AdvisorStudentsTable students={students} termId={term?.termId ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
