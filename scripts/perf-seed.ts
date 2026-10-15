/**
 * npm run perf:seed — sinh dữ liệu GIẢ quy mô lớn để đo hiệu năng (docs/rules/05, Phase 7).
 * CHỈ chạy trên DB riêng (tên DB phải kết thúc bằng `_perf`), VD:
 *   DATABASE_URL=postgresql://…/ewars_perf npm run perf:seed
 * 5.000 sinh viên · 100 lớp · 50 Cố vấn học tập · 40 học phần · 2 học kỳ. Ngẫu nhiên có seed
 * cố định → chạy lại ra cùng dữ liệu. Không dùng dữ liệu sinh viên thật (docs/rules/04).
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { type EntityManager } from 'typeorm';
import { closeDataSource, getDataSource } from '../src/db/data-source';
import { AdministrativeClass } from '../src/db/entities/administrative-class.entity';
import { AttendanceSummary } from '../src/db/entities/attendance-summary.entity';
import { CourseResult } from '../src/db/entities/course-result.entity';
import { Course } from '../src/db/entities/course.entity';
import { Enrollment } from '../src/db/entities/enrollment.entity';
import { ImportBatch } from '../src/db/entities/import-batch.entity';
import { LmsQuizAttempt } from '../src/db/entities/lms-quiz-attempt.entity';
import { Student } from '../src/db/entities/student.entity';
import { Term } from '../src/db/entities/term.entity';
import { User } from '../src/db/entities/user.entity';
import {
  AttemptOutcome,
  CourseResultStatus,
  EnrollmentStatus,
  ImportBatchStatus,
  ImportSource,
  OfficialAcademicStatus,
  QuizAttemptStatus,
  UserAccountStatus,
  UserRole,
} from '../src/db/enums';
import { getEnv } from '../src/lib/env';
import { logger } from '../src/lib/logger';
import { PERF } from './perf-config';

/** PRNG mulberry32 — cùng seed ra cùng dữ liệu. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261015);
const vn = (date: string, time = '08:00:00') => new Date(`${date}T${time}+07:00`);
const pad = (n: number, len: number) => String(n).padStart(len, '0');
const round1 = (x: number) => Math.round(Math.min(10, Math.max(0, x)) * 10) / 10;
/** Xấp xỉ phân phối chuẩn (tổng 3 số đều). */
const normal = (mean: number, sd: number) => mean + sd * ((rand() + rand() + rand()) * 2 - 3);

async function insertChunked<T extends object>(
  em: EntityManager,
  entity: new () => T,
  rows: T[],
  size = 2000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await em.insert(entity, rows.slice(i, i + size));
  }
}

function letterOf(score: number): { letter: string; passed: boolean } {
  const bands: [number, string][] = [
    [9.5, 'A+'],
    [8.5, 'A'],
    [8, 'B+'],
    [7, 'B'],
    [6.5, 'C+'],
    [5.5, 'C'],
    [5, 'D+'],
    [4, 'D'],
  ];
  const hit = bands.find(([min]) => score >= min);
  return hit ? { letter: hit[1], passed: true } : { letter: 'F', passed: false };
}

async function seedIdentity(em: EntityManager) {
  const classCount = PERF.students / PERF.classSize;
  const advisors = Array.from({ length: classCount / 2 }, (_, i) => `PGV${pad(i + 1, 3)}`);
  await insertChunked(
    em,
    User,
    advisors.map((userId) =>
      em.create(User, {
        userId,
        fullName: `Cố vấn ${userId}`,
        role: UserRole.ADVISOR,
        email: `${userId.toLowerCase()}@ctuet.edu.vn`,
        accountStatus: UserAccountStatus.ACTIVE,
        authUserId: null,
      }),
    ),
  );
  const classes = Array.from({ length: classCount }, (_, i) => {
    const departmentId = PERF.departments[i % PERF.departments.length] ?? 'K.CNTT';
    return em.create(AdministrativeClass, {
      classId: `P${pad(i + 1, 3)}2311`,
      className: `Lớp hiệu năng ${i + 1}`,
      departmentId,
      cohortYear: '2023',
      advisorId: advisors[Math.floor(i / 2)] ?? null,
    });
  });
  await insertChunked(em, AdministrativeClass, classes);
  const students = Array.from({ length: PERF.students }, (_, i) => ({
    studentId: `P${pad(i + 1, 6)}`,
    classId: classes[Math.floor(i / PERF.classSize)]?.classId ?? '',
  }));
  await insertChunked(
    em,
    User,
    students.map((s) =>
      em.create(User, {
        userId: s.studentId,
        fullName: `Sinh viên ${s.studentId}`,
        role: UserRole.STUDENT,
        email: `${s.studentId.toLowerCase()}@student.ctuet.edu.vn`,
        accountStatus: UserAccountStatus.ACTIVE,
        authUserId: null,
      }),
    ),
  );
  await insertChunked(
    em,
    Student,
    students.map((s) =>
      em.create(Student, {
        studentId: s.studentId,
        fullName: `Sinh viên ${s.studentId}`,
        classId: s.classId,
        officialAcademicStatus: OfficialAcademicStatus.ACTIVE,
      }),
    ),
  );
  return { classes, students };
}

async function seedTermsAndCourses(em: EntityManager) {
  await em.update(Term, { isCurrent: true }, { isCurrent: false });
  await em.insert(Term, [
    {
      termId: PERF.previousTerm,
      termName: 'Học kỳ 2, 2025–2026 (hiệu năng)',
      academicYear: '2025-2026',
      startDate: vn('2026-01-05', '00:00:00'),
      endDate: vn('2026-05-31', '23:59:59'),
      isCurrent: false,
      closedAt: null,
    },
    {
      termId: PERF.currentTerm,
      termName: 'Học kỳ 1, 2026–2027 (hiệu năng)',
      academicYear: '2026-2027',
      startDate: vn('2026-08-17', '00:00:00'),
      endDate: vn('2026-12-27', '23:59:59'),
      isCurrent: true,
      closedAt: null,
    },
  ]);
  const courses = Array.from({ length: PERF.courses }, (_, i) =>
    em.create(Course, {
      courseId: `PC${pad(i + 1, 3)}`,
      courseName: `Học phần hiệu năng ${i + 1}`,
      credits: 3,
      theoryPeriods: 30,
      practicePeriods: 30,
    }),
  );
  await insertChunked(em, Course, courses);
  return courses.map((c) => c.courseId);
}

function batch(em: EntityManager, dataType: string, termId: string): ImportBatch {
  return em.create(ImportBatch, {
    id: randomUUID(),
    dataType,
    termId,
    source: ImportSource.FILE,
    fileName: `perf-${dataType.toLowerCase()}.csv`,
    sourceChecksum: randomUUID().replace(/-/g, ''),
    performedBy: 'ADMIN',
    status: ImportBatchStatus.RECONCILED,
    totalRows: 0,
    successRows: 0,
    errorRows: 0,
    warnings: null,
    summary: null,
    errorMessage: null,
    parentBatchId: null,
    originalFilePath: 'perf/none',
    stagedAt: new Date(),
    loadedAt: new Date(),
    completedAt: new Date(),
  });
}

/** Học kỳ trước: 2 học phần / sinh viên, kết quả cuối kỳ (~8% rớt → có học lại). */
async function seedPreviousTerm(
  em: EntityManager,
  students: { studentId: string; classId: string }[],
  courseIds: string[],
  failed: Set<string>,
) {
  const b = batch(em, 'COURSE_RESULT', PERF.previousTerm);
  await em.insert(ImportBatch, b);
  const enrollments: Enrollment[] = [];
  const results: CourseResult[] = [];
  for (const [i, s] of students.entries()) {
    for (const courseId of [courseIds[i % 10], courseIds[10 + (i % 10)]] as string[]) {
      const score = round1(normal(6.8, 1.8));
      const { letter, passed } = letterOf(score);
      const enrollmentId = randomUUID();
      if (!passed) failed.add(`${s.studentId}|${courseId}`);
      enrollments.push(
        em.create(Enrollment, {
          enrollmentId,
          studentId: s.studentId,
          courseId,
          termId: PERF.previousTerm,
          enrollmentStatus: EnrollmentStatus.COMPLETED,
          attemptNumber: 1,
          attemptOutcome: passed ? AttemptOutcome.PASSED : AttemptOutcome.FAILED,
          firstSeenBatchId: b.id,
        }),
      );
      results.push(
        em.create(CourseResult, {
          enrollmentId,
          processScore: round1(score + normal(0, 0.5)),
          examScore: round1(score + normal(0, 0.8)),
          finalScore: score,
          letterGrade: letter,
          passed,
          resultStatus: CourseResultStatus.FINAL,
          importBatchId: b.id,
          publishedAt: vn('2026-06-10'),
          importedAt: new Date(),
          processPublishedAt: vn('2026-04-01'),
        }),
      );
    }
  }
  await insertChunked(em, Enrollment, enrollments);
  await insertChunked(em, CourseResult, results);
}

/** Học kỳ hiện tại: 5 học phần / sinh viên (theo lớp), điểm danh 2 lần chốt, 4 bài LMS, điểm quá trình. */
async function seedCurrentTerm(
  em: EntityManager,
  students: { studentId: string; classId: string }[],
  courseIds: string[],
  failed: Set<string>,
) {
  const [attBatch, lmsBatch, resBatch] = [
    batch(em, 'ATTENDANCE_SUMMARY', PERF.currentTerm),
    batch(em, 'LMS_QUIZ', PERF.currentTerm),
    batch(em, 'COURSE_RESULT', PERF.currentTerm),
  ];
  await em.insert(ImportBatch, [attBatch, lmsBatch, resBatch]);
  const enrollments: Enrollment[] = [];
  const attendance: AttendanceSummary[] = [];
  const attempts: LmsQuizAttempt[] = [];
  const results: CourseResult[] = [];
  const quizDays = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'];
  for (const [i, s] of students.entries()) {
    const classIndex = Math.floor(i / PERF.classSize);
    const risky = rand() < 0.15; // ~15% sinh viên có xu hướng rủi ro
    for (let k = 0; k < PERF.coursesPerStudent; k++) {
      const courseId = courseIds[(classIndex + k * 7) % courseIds.length] ?? 'PC001';
      const enrollmentId = randomUUID();
      enrollments.push(
        em.create(Enrollment, {
          enrollmentId,
          studentId: s.studentId,
          courseId,
          termId: PERF.currentTerm,
          enrollmentStatus: EnrollmentStatus.REGISTERED,
          attemptNumber: failed.has(`${s.studentId}|${courseId}`) ? 2 : 1,
          attemptOutcome: AttemptOutcome.PENDING,
          firstSeenBatchId: attBatch.id,
        }),
      );
      const absent1 = Math.floor(rand() * (risky ? 4 : 2));
      const absent2 = absent1 + Math.floor(rand() * (risky ? 5 : 2));
      for (const [date, total, unexcused] of [
        ['2026-10-02', 14, absent1],
        ['2026-10-09', 16, absent2],
      ] as const) {
        const late = Math.floor(rand() * (risky ? 4 : 2));
        attendance.push(
          em.create(AttendanceSummary, {
            enrollmentId,
            snapshotDate: vn(date, '00:00:00'),
            totalSessions: total,
            plannedSessions: 30,
            present: total - unexcused - late,
            late,
            excusedAbsence: 0,
            unexcusedAbsence: unexcused,
            sectionCode: s.classId,
            importBatchId: attBatch.id,
          }),
        );
      }
      for (const [q, day] of quizDays.entries()) {
        if (rand() < (risky ? 0.7 : 0.95)) {
          const startedAt = vn(day, `${pad(8 + Math.floor(rand() * 10), 2)}:00:00`);
          attempts.push(
            em.create(LmsQuizAttempt, {
              enrollmentId,
              quizKey: `Q${q + 1}`,
              quizName: `Kiểm tra ${q + 1}`,
              attemptNumber: 1,
              startedAt,
              submittedAt: new Date(startedAt.getTime() + 20 * 60_000),
              durationMinutes: 20,
              score: round1(normal(risky ? 5 : 7.5, 1.5)),
              maxScore: 10,
              status: QuizAttemptStatus.SUBMITTED,
              sectionCode: s.classId,
              importBatchId: lmsBatch.id,
            }),
          );
        }
      }
      results.push(
        em.create(CourseResult, {
          enrollmentId,
          processScore: round1(normal(risky ? 5 : 7.2, 1.4)),
          examScore: null,
          finalScore: null,
          letterGrade: null,
          passed: null,
          resultStatus: CourseResultStatus.PROCESS_ONLY,
          importBatchId: resBatch.id,
          publishedAt: vn('2026-10-05'),
          importedAt: new Date(),
          processPublishedAt: vn('2026-10-05'),
        }),
      );
    }
  }
  await insertChunked(em, Enrollment, enrollments);
  await insertChunked(em, AttendanceSummary, attendance);
  await insertChunked(em, LmsQuizAttempt, attempts);
  await insertChunked(em, CourseResult, results);
  return {
    enrollments: enrollments.length,
    attendance: attendance.length,
    attempts: attempts.length,
    results: results.length,
  };
}

async function main() {
  getEnv();
  const dbName = new URL(getEnv().DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith('_perf')) {
    throw new Error(`Chỉ chạy trên DB tên kết thúc bằng _perf (đang trỏ tới "${dbName}").`);
  }
  const ds = await getDataSource();
  if (await ds.getRepository(Term).existsBy({ termId: PERF.currentTerm })) {
    logger.info('dữ liệu hiệu năng đã có — bỏ qua');
    return;
  }
  const started = Date.now();
  const counts = await ds.transaction(async (em) => {
    const { students } = await seedIdentity(em);
    const courseIds = await seedTermsAndCourses(em);
    const failed = new Set<string>();
    await seedPreviousTerm(em, students, courseIds, failed);
    return {
      students: students.length,
      failed: failed.size,
      ...(await seedCurrentTerm(em, students, courseIds, failed)),
    };
  });
  logger.info({ ...counts, seconds: (Date.now() - started) / 1000 }, 'perf:seed xong');
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, 'perf:seed lỗi');
    process.exitCode = 1;
  })
  .finally(() => void closeDataSource());
