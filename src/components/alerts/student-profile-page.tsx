import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/page-header';
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
  manageEnrollments = false,
}: {
  studentId: string;
  requestedTerm?: string;
  backHref: string;
  backLabel: string;
  /** Admin: đánh dấu rút học phần (chỉ khi học kỳ chưa chốt). */
  manageEnrollments?: boolean;
}) {
  const terms = await listTermOptions();
  const term = pickTerm(terms, requestedTerm);
  const profile = term ? await getStudentProfile(studentId, term.termId) : null;
  if (!profile || !term) notFound();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <PageBreadcrumbs
          items={[{ label: backLabel, href: backHref }, { label: profile.fullName }]}
        />
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
          <CourseSnapshotTable
            courses={profile.courses}
            manageStudentId={
              manageEnrollments && !profile.termClosed ? profile.studentId : undefined
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
