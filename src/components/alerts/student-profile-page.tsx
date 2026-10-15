import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { getStudentProfile } from '@/modules/alerts/services/student-profile.service';
import { CourseSnapshotTable } from './student-profile-view';
import { TermFilter } from './term-filter';

/** Hồ sơ học tập theo học phần — trang dùng chung; GỌI SAU assertScope ở trang. */
export async function StudentProfilePage({
  studentId,
  requestedTerm,
  backHref,
  backLabel,
}: {
  studentId: string;
  requestedTerm?: string;
  backHref: string;
  backLabel: string;
}) {
  const terms = await listTermOptions();
  const term = pickTerm(terms, requestedTerm);
  const profile = term ? await getStudentProfile(studentId, term.termId) : null;
  if (!profile || !term) notFound();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft aria-hidden />
            {backLabel}
          </Link>
        </Button>
        <h1 className="mt-2">
          {profile.fullName} · {profile.studentId}
        </h1>
        <p className="mt-1 text-muted-foreground">Lớp {profile.classId}</p>
      </div>
      <TermFilter terms={terms} value={term.termId} />
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Học tập theo học phần · {profile.termName}</CardTitle>
          <CardDescription>Số liệu điểm danh lấy theo ngày chốt gần nhất.</CardDescription>
        </CardHeader>
        <CardContent>
          <CourseSnapshotTable courses={profile.courses} />
        </CardContent>
      </Card>
    </div>
  );
}
