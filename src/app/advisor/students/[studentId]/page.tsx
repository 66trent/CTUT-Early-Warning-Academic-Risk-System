import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StudentProfilePage } from '@/components/alerts/student-profile-page';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { assertScope } from '@/lib/authz';

export const metadata: Metadata = { title: 'Hồ sơ sinh viên' };

export default async function AdvisorStudentProfile({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const user = await requireUser([UserRole.ADVISOR]);
  const { studentId } = await params;
  // Chỉ sinh viên thuộc lớp mình phụ trách (docs/rules/06) — ngoài phạm vi trả 404 (chống dò mã).
  const allowed = await assertScope(user, { studentId, resourceType: 'Student' }).then(
    () => true,
    () => false,
  );
  if (!allowed) notFound();
  return (
    <StudentProfilePage
      studentId={studentId}
      requestedTerm={(await searchParams).term}
      backHref="/advisor/students"
      backLabel="Sinh viên phụ trách"
    />
  );
}
