import type { Metadata } from 'next';
import { StudentProfilePage } from '@/components/alerts/student-profile-page';
import { UserRole } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { requireUser } from '@/lib/auth-server';

export const metadata: Metadata = { title: 'Hồ sơ sinh viên' };

/** Admin xem hồ sơ (chỉ đọc) — không phải Cố vấn học tập phụ trách → Audit Log (docs/rules/06). */
export default async function AdminStudentProfile({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const user = await requireUser([UserRole.ADMIN]);
  const { studentId } = await params;
  await writeAuditLog({
    actorId: user.userId,
    action: 'STUDENT_PROFILE_VIEWED',
    targetType: 'Student',
    targetId: studentId,
  });
  return (
    <StudentProfilePage
      studentId={studentId}
      requestedTerm={(await searchParams).term}
      backHref="/admin/alerts"
      backLabel="Cảnh báo sớm"
    />
  );
}
