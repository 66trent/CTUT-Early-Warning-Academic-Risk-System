import { In } from 'typeorm';
import { type EntityManager } from 'typeorm';
import { Course } from '@/db/entities/course.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { type ImportBatch } from '@/db/entities/import-batch.entity';
import { AttemptOutcome, EnrollmentStatus } from '@/db/enums';
import { type AcademicRowBase, pairKey } from '../types/academic-row';

export interface StudentCoursePair {
  studentId: string;
  courseId: string;
}

/**
 * Tự tạo `Course` còn thiếu (docs/rules/09). Tên lấy từ `ten_hoc_phan`; file không có tên
 * (LMS) thì tạm dùng mã học phần và được thay khi file khác có tên thật.
 */
async function ensureCourses(em: EntityManager, rows: readonly AcademicRowBase[]): Promise<void> {
  const names = new Map<string, string | null>();
  for (const row of rows) {
    if (!names.get(row.courseId)) names.set(row.courseId, row.courseName);
  }
  const existing = await em.find(Course, { where: { courseId: In([...names.keys()]) } });
  const byId = new Map(existing.map((c) => [c.courseId, c]));
  const missing = [...names].filter(([id]) => !byId.has(id));
  if (missing.length > 0) {
    await em
      .createQueryBuilder()
      .insert()
      .into(Course)
      .values(missing.map(([courseId, name]) => ({ courseId, courseName: name ?? courseId })))
      .orIgnore()
      .execute();
  }
  for (const [courseId, name] of names) {
    const course = byId.get(courseId);
    if (course && name && course.courseName === course.courseId) {
      await em.update(Course, { courseId }, { courseName: name });
    }
  }
}

/**
 * Tính lại `attemptNumber` = 1 + số học kỳ TRƯỚC (theo `Term.startDate`) có kết quả FAILED
 * cho cùng (sinh viên, học phần) — áp cho MỌI học kỳ của các cặp đã cho (docs/rules/09, 10).
 */
export async function recomputeAttemptNumbers(
  em: EntityManager,
  pairs: readonly StudentCoursePair[],
): Promise<void> {
  const unique = [...new Map(pairs.map((p) => [pairKey(p), p])).values()];
  if (unique.length === 0) return;
  await em.query(
    `UPDATE enrollments e
        SET attempt_number = 1 + (
          SELECT COUNT(*) FROM enrollments p
            JOIN terms tp ON tp.term_id = p.term_id
           WHERE p.student_id = e.student_id AND p.course_id = e.course_id
             AND p.attempt_outcome = $3 AND tp.start_date < t.start_date)
       FROM terms t
      WHERE t.term_id = e.term_id
        AND (e.student_id, e.course_id) IN (
          SELECT * FROM unnest($1::varchar[], $2::varchar[]))`,
    [unique.map((p) => p.studentId), unique.map((p) => p.courseId), AttemptOutcome.FAILED],
  );
}

/** Lớp học phần hiện tại của Enrollment = `ma_lop_hoc_phan` của dòng nguồn gần nhất (docs/rules/09). */
async function syncSectionCodes(
  em: EntityManager,
  enrollments: readonly Pick<
    Enrollment,
    'enrollmentId' | 'studentId' | 'courseId' | 'sectionCode'
  >[],
  pairs: readonly AcademicRowBase[],
): Promise<void> {
  const sectionOf = new Map(pairs.map((p) => [pairKey(p), p.sectionCode]));
  for (const e of enrollments) {
    const section = sectionOf.get(pairKey(e));
    if (section && section !== e.sectionCode) {
      await em.update(Enrollment, { enrollmentId: e.enrollmentId }, { sectionCode: section });
    }
  }
}

/**
 * Tìm hoặc tạo `Enrollment` cho các dòng của lô (học kỳ của lô), trong transaction `em`.
 * Trả map `mssv|mã học phần` → enrollmentId. Course/Enrollment là ngoại lệ DUY NHẤT được tự tạo.
 */
export async function ensureEnrollments(
  em: EntityManager,
  batch: ImportBatch,
  rows: readonly AcademicRowBase[],
): Promise<Map<string, string>> {
  const termId = batch.termId ?? '';
  await ensureCourses(em, rows);
  const pairs = [...new Map(rows.map((r) => [pairKey(r), r])).values()];
  const find = () =>
    em.find(Enrollment, {
      select: { enrollmentId: true, studentId: true, courseId: true, sectionCode: true },
      where: {
        termId,
        studentId: In([...new Set(pairs.map((p) => p.studentId))]),
        courseId: In([...new Set(pairs.map((p) => p.courseId))]),
      },
    });
  let found = await find();
  const known = new Set(found.map(pairKey));
  const missing = pairs.filter((p) => !known.has(pairKey(p)));
  if (missing.length > 0) {
    await em
      .createQueryBuilder()
      .insert()
      .into(Enrollment)
      .values(
        missing.map((p) => ({
          studentId: p.studentId,
          courseId: p.courseId,
          termId,
          enrollmentStatus: EnrollmentStatus.REGISTERED,
          attemptNumber: 1,
          attemptOutcome: AttemptOutcome.PENDING,
          sectionCode: p.sectionCode,
          firstSeenBatchId: batch.id,
        })),
      )
      .orIgnore()
      .execute();
    await recomputeAttemptNumbers(em, missing);
    found = await find();
  }
  await syncSectionCodes(em, found, pairs);
  return new Map(found.map((e) => [pairKey(e), e.enrollmentId]));
}

/**
 * Hoàn tác: xóa `Enrollment` do lô tạo mà không còn dữ liệu nguồn nào (docs/rules/12).
 * Trả các cặp đã xóa để tính lại lần học.
 */
export async function deleteOrphanEnrollments(
  em: EntityManager,
  batchId: string,
): Promise<StudentCoursePair[]> {
  const deleted: [{ student_id: string; course_id: string }[], number] = await em.query(
    `DELETE FROM enrollments e
      WHERE e.first_seen_batch_id = $1
        AND NOT EXISTS (SELECT 1 FROM attendance_summaries a WHERE a.enrollment_id = e.enrollment_id)
        AND NOT EXISTS (SELECT 1 FROM lms_quiz_attempts q WHERE q.enrollment_id = e.enrollment_id)
        AND NOT EXISTS (SELECT 1 FROM lms_assignment_submissions s WHERE s.enrollment_id = e.enrollment_id)
        AND NOT EXISTS (SELECT 1 FROM course_results r WHERE r.enrollment_id = e.enrollment_id)
      RETURNING e.student_id, e.course_id`,
    [batchId],
  );
  return deleted[0].map((r) => ({ studentId: r.student_id, courseId: r.course_id }));
}
