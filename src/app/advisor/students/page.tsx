import type { Metadata } from 'next';
import Link from 'next/link';
import { TermFilter } from '@/components/alerts/term-filter';
import { AlertStatusBadge } from '@/components/domain/alert-status-badge';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserRole } from '@/db/enums';
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
  const students = term ? await listAdvisorStudents(user.userId, term.termId) : [];
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1>Sinh viên phụ trách</h1>
      {term && <TermFilter terms={terms} value={term.termId} />}
      <Card className="shadow-sm">
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sinh viên</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Cảnh báo học kỳ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Bạn chưa được phân công lớp sinh hoạt nào.
                    </TableCell>
                  </TableRow>
                )}
                {students.map((s) => (
                  <TableRow key={s.studentId} className="even:bg-muted">
                    <TableCell>
                      <Link
                        href={`/advisor/students/${s.studentId}?term=${term?.termId ?? ''}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {s.fullName}
                      </Link>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {s.studentId}
                      </span>
                    </TableCell>
                    <TableCell>{s.classId}</TableCell>
                    <TableCell>
                      {s.severity && s.status ? (
                        <span className="flex flex-wrap gap-2">
                          <SeverityBadge severity={s.severity} />
                          <AlertStatusBadge status={s.status} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Không có</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
