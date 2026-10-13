import { type EntityManager } from 'typeorm';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { Term } from '@/db/entities/term.entity';
import { EnrollmentStatus } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';

/**
 * Admin đánh dấu / bỏ đánh dấu "đã rút học phần" (docs/rules/08, 09). KHÔNG chạy đánh giá và
 * không sửa cảnh báo ngay — lần chạy kế tiếp bỏ qua học phần đã rút. Cả 2 chiều ghi Audit Log.
 * Học phần đã có kết quả cuối kỳ (COMPLETED) không rút được; học kỳ đã chốt không sửa được.
 */
export async function setEnrollmentWithdrawn(
  em: EntityManager,
  input: { studentId: string; enrollmentId: string; withdrawn: boolean },
  actorId: string,
): Promise<void> {
  const { studentId, enrollmentId, withdrawn } = input;
  const enrollment = await em.findOne(Enrollment, {
    where: { enrollmentId },
    lock: { mode: 'pessimistic_write' },
  });
  // Khớp cả sinh viên: phạm vi đã kiểm theo studentId ở Server Action (docs/rules/06).
  if (enrollment?.studentId !== studentId)
    throw new AppError('ENROLLMENT_NOT_FOUND', 'Không tìm thấy học phần của sinh viên.');
  const term = await em.findOneByOrFail(Term, { termId: enrollment.termId });
  if (term.closedAt) {
    throw new AppError('TERM_CLOSED', `${term.termName} đã chốt, không sửa được nữa.`);
  }
  const from = withdrawn ? EnrollmentStatus.REGISTERED : EnrollmentStatus.WITHDRAWN;
  if (enrollment.enrollmentStatus !== from) {
    throw new AppError(
      'INVALID_STATUS',
      withdrawn
        ? enrollment.enrollmentStatus === EnrollmentStatus.COMPLETED
          ? 'Học phần đã có kết quả cuối kỳ, không đánh dấu rút được.'
          : 'Học phần này đã được đánh dấu rút.'
        : 'Học phần này chưa được đánh dấu rút.',
    );
  }
  await em.update(
    Enrollment,
    { enrollmentId },
    { enrollmentStatus: withdrawn ? EnrollmentStatus.WITHDRAWN : EnrollmentStatus.REGISTERED },
  );
  await writeAuditLog(
    {
      actorId,
      action: withdrawn ? 'ENROLLMENT_WITHDRAWN' : 'ENROLLMENT_WITHDRAWAL_UNDONE',
      targetType: 'Enrollment',
      targetId: enrollmentId,
      detail: {
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        termId: enrollment.termId,
      },
    },
    em,
  );
}
