import { In } from 'typeorm';
import { type EntityManager } from 'typeorm';
import { Course } from '@/db/entities/course.entity';
import { type ImportBatch, type ImportCourseCard } from '@/db/entities/import-batch.entity';
import { type CardInput } from '../types/definition';

/** Số liệu cộng dồn của 1 học phần trong file, trước khi tra dữ liệu nền. */
interface CardAccumulator {
  courseName: string | null;
  derivedCode: boolean;
  sections: Set<string>;
  validRows: number;
  errorRows: number;
  warningRows: number;
  students: Set<string>;
  totalPeriods: number | null;
  snapshotDates: Set<string>;
  activities: Map<string, { key: string; name: string; dueAt: string | null }>;
  credits: number | null;
  publishedDates: Set<string>;
}

export type CardAccumulators = Map<string, CardAccumulator>;

const MAX_CARDS = 200;

/** Cộng 1 dòng (hợp lệ hoặc lỗi đối chiếu) vào thẻ học phần của nó (docs/rules/12). */
export function addToCard(
  cards: CardAccumulators,
  input: CardInput,
  outcome: { valid: boolean; warned: boolean },
): void {
  let card = cards.get(input.courseId);
  if (!card) {
    if (cards.size >= MAX_CARDS) return;
    card = {
      courseName: null,
      derivedCode: false,
      sections: new Set(),
      validRows: 0,
      errorRows: 0,
      warningRows: 0,
      students: new Set(),
      totalPeriods: null,
      snapshotDates: new Set(),
      activities: new Map(),
      credits: null,
      publishedDates: new Set(),
    };
    cards.set(input.courseId, card);
  }
  card.courseName ??= input.courseName;
  card.derivedCode ||= input.derivedCode;
  card.sections.add(input.sectionCode);
  if (!outcome.valid) {
    card.errorRows += 1;
    return;
  }
  card.validRows += 1;
  if (outcome.warned) card.warningRows += 1;
  card.students.add(input.studentId);
  if (input.totalPeriods !== undefined) card.totalPeriods = input.totalPeriods;
  if (input.snapshotDate) card.snapshotDates.add(input.snapshotDate);
  if (input.activity) card.activities.set(input.activity.key, input.activity);
  if (input.credits !== undefined) card.credits = input.credits;
  if (input.publishedDate) card.publishedDates.add(input.publishedDate);
}

/** Lớp sinh hoạt + khoa của từng sinh viên. */
async function classesOf(
  em: EntityManager,
  studentIds: readonly string[],
): Promise<Map<string, { classId: string; departmentId: string }>> {
  if (studentIds.length === 0) return new Map();
  const rows: { student_id: string; class_id: string; department_id: string }[] = await em.query(
    `SELECT s.student_id, c.class_id, c.department_id
       FROM students s JOIN administrative_classes c ON c.class_id = s.class_id
      WHERE s.student_id = ANY($1::varchar[])`,
    [studentIds],
  );
  return new Map(
    rows.map((r) => [r.student_id, { classId: r.class_id, departmentId: r.department_id }]),
  );
}

/** Ngày chốt điểm danh gần nhất đã có của học phần trong học kỳ (trước lô này). */
async function previousSnapshot(
  em: EntityManager,
  batch: ImportBatch,
  courseId: string,
): Promise<string | null> {
  const [row]: { latest: Date | null }[] = await em.query(
    `SELECT MAX(a.snapshot_date) AS latest
       FROM attendance_summaries a JOIN enrollments e ON e.enrollment_id = a.enrollment_id
      WHERE e.course_id = $1 AND e.term_id = $2 AND a.import_batch_id <> $3`,
    [courseId, batch.termId, batch.id],
  );
  return row?.latest
    ? new Date(row.latest.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
    : null;
}

/** Hoàn thiện thẻ nhận diện: học phần mới hay đã có, phân bổ lớp/khoa, ngày chốt trước đó. */
export async function buildCourseCards(
  em: EntityManager,
  batch: ImportBatch,
  cards: CardAccumulators,
): Promise<ImportCourseCard[]> {
  if (cards.size === 0) return [];
  const courses = await em.find(Course, { where: { courseId: In([...cards.keys()]) } });
  const known = new Map(courses.map((c) => [c.courseId, c]));
  const allStudents = [...new Set([...cards.values()].flatMap((c) => [...c.students]))];
  const classOf = await classesOf(em, allStudents);
  const result: ImportCourseCard[] = [];
  for (const [courseId, card] of cards) {
    const counts = new Map<string, { classId: string; departmentId: string; count: number }>();
    for (const studentId of card.students) {
      const info = classOf.get(studentId);
      if (!info) continue;
      const entry = counts.get(info.classId) ?? { ...info, count: 0 };
      entry.count += 1;
      counts.set(info.classId, entry);
    }
    const course = known.get(courseId);
    result.push({
      courseId,
      courseName: card.courseName ?? course?.courseName ?? courseId,
      derivedCode: card.derivedCode,
      isNew: !course,
      sectionCodes: [...card.sections].sort().slice(0, 50),
      validRows: card.validRows,
      errorRows: card.errorRows,
      warningRows: card.warningRows,
      studentCount: card.students.size,
      classes: [...counts.values()].sort((a, b) => b.count - a.count),
      ...(card.snapshotDates.size > 0
        ? {
            totalPeriods: card.totalPeriods,
            snapshotDates: [...card.snapshotDates].sort().slice(0, 50),
            previousSnapshotDate: await previousSnapshot(em, batch, courseId),
          }
        : {}),
      ...(card.activities.size > 0
        ? { activities: [...card.activities.values()].slice(0, 200) }
        : {}),
      ...(card.publishedDates.size > 0 || card.credits !== null
        ? { credits: card.credits, publishedDates: [...card.publishedDates].sort().slice(0, 50) }
        : {}),
    });
  }
  return result.sort((a, b) => a.courseName.localeCompare(b.courseName, 'vi'));
}
