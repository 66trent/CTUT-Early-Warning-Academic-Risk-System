/**
 * Đọc toàn bộ dữ liệu của 1 khóa học Moodle cần cho 3 nguồn (docs/tich-hop-moodle.md mục 2) qua
 * web service CHỈ ĐỌC. Không đụng DB EWARS — kết quả đưa vào mapper thuần (`mappers.ts`).
 * Phase 10c tách 2 bước: phần "rẻ" (~8 lần gọi / khóa) + lượt làm trắc nghiệm (1 lần gọi / bài /
 * sinh viên) — lịch 10 phút chỉ gọi phần rẻ + sổ điểm để tính dấu vân tay.
 */
import { createHash } from 'node:crypto';
import { type z } from 'zod';
import { type MoodleClient, type MoodleParams } from './client';
import {
  assignmentsSchema,
  attendanceSessionsSchema,
  courseContentsSchema,
  coursesByFieldSchema,
  enrolledUsersSchema,
  gradeItemsSchema,
  type MoodleAssignment,
  type MoodleAttendanceSession,
  type MoodleCourse,
  type MoodleEnrolledUser,
  type MoodleGradeItems,
  type MoodleQuiz,
  type MoodleQuizAttempt,
  type MoodleSubmission,
  quizAttemptsSchema,
  quizzesSchema,
  submissionsSchema,
  userFlagsSchema,
} from './schemas';

/** Phần đọc được bằng vài lần gọi / khóa (không có lượt làm trắc nghiệm). */
export interface MoodleCourseBase {
  course: MoodleCourse;
  /** Chỉ người có vai `student` (giảng viên không sinh dòng). */
  students: MoodleEnrolledUser[];
  quizzes: MoodleQuiz[];
  assignments: MoodleAssignment[];
  /** assignmentId → userId → bài nộp mới nhất. */
  submissions: Map<number, Map<number, MoodleSubmission>>;
  /** assignmentId → userId → hạn gia hạn riêng (Unix giây). */
  extensions: Map<number, Map<number, number>>;
  sessions: MoodleAttendanceSession[];
}

export interface MoodleCourseData extends MoodleCourseBase {
  /** quizId → userId → các lượt (kể cả lượt chưa nộp). */
  attempts: Map<number, Map<number, MoodleQuizAttempt[]>>;
}

async function get<S extends z.ZodType>(
  client: MoodleClient,
  fn: string,
  schema: S,
  params: MoodleParams = {},
): Promise<z.infer<S>> {
  const raw = await client.call<unknown>(fn, params);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Moodle trả dữ liệu không đúng cấu trúc (${fn}): ${parsed.error.issues[0]?.message ?? ''}`,
    );
  }
  return parsed.data;
}

/** Mọi khóa học trên Moodle (trừ trang chủ id 1) — trang Kết nối Moodle chọn khóa để liên kết. */
export async function listMoodleCourses(client: MoodleClient): Promise<MoodleCourse[]> {
  const { courses } = await get(client, 'core_course_get_courses_by_field', coursesByFieldSchema);
  return courses.filter((c) => c.id !== 1);
}

async function fetchAssignmentState(
  client: MoodleClient,
  assignments: MoodleAssignment[],
): Promise<Pick<MoodleCourseBase, 'submissions' | 'extensions'>> {
  const submissions = new Map<number, Map<number, MoodleSubmission>>();
  const extensions = new Map<number, Map<number, number>>();
  const assignmentids = assignments.map((a) => a.id);
  if (assignmentids.length === 0) return { submissions, extensions };
  const subs = await get(client, 'mod_assign_get_submissions', submissionsSchema, {
    assignmentids,
  });
  const flags = await get(client, 'mod_assign_get_user_flags', userFlagsSchema, { assignmentids });
  for (const a of subs.assignments) {
    submissions.set(a.assignmentid, new Map(a.submissions.map((s) => [s.userid, s])));
  }
  for (const a of flags.assignments) {
    const map = new Map<number, number>();
    for (const f of a.userflags) if (f.extensionduedate) map.set(f.userid, f.extensionduedate);
    extensions.set(a.assignmentid, map);
  }
  return { submissions, extensions };
}

/** Phần rẻ của 1 khóa (không gọi lượt làm từng sinh viên). */
export async function fetchMoodleCourseBase(
  client: MoodleClient,
  moodleCourseId: number,
): Promise<MoodleCourseBase> {
  const { courses } = await get(client, 'core_course_get_courses_by_field', coursesByFieldSchema, {
    field: 'id',
    value: moodleCourseId,
  });
  const course = courses[0];
  if (!course) throw new Error(`Moodle không còn khóa học id ${moodleCourseId}.`);

  // Gọi TUẦN TỰ: gọi song song làm Moodle tranh khóa cache ("Unable to acquire a lock", Phase 10b).
  const contents = await get(client, 'core_course_get_contents', courseContentsSchema, {
    courseid: course.id,
  });
  const users = await get(client, 'core_enrol_get_enrolled_users', enrolledUsersSchema, {
    courseid: course.id,
  });
  const quizList = await get(client, 'mod_quiz_get_quizzes_by_courses', quizzesSchema, {
    courseids: [course.id],
  });
  // Tài khoản dịch vụ không ghi danh → bắt buộc includenotenrolledcourses (Phase 10a).
  const assignList = await get(client, 'mod_assign_get_assignments', assignmentsSchema, {
    courseids: [course.id],
    includenotenrolledcourses: true,
  });
  const students = users.filter((u) => u.roles.some((r) => r.shortname === 'student'));
  const quizzes = quizList.quizzes.filter((q) => q.course === course.id);
  const assignments = assignList.courses.find((c) => c.id === course.id)?.assignments ?? [];
  const state = await fetchAssignmentState(client, assignments);

  const sessions: MoodleAttendanceSession[] = [];
  const attendanceModules = contents
    .flatMap((s) => s.modules)
    .filter((m) => m.modname === 'attendance');
  for (const attendanceModule of attendanceModules) {
    sessions.push(
      ...(await get(client, 'mod_attendance_get_sessions', attendanceSessionsSchema, {
        attendanceid: attendanceModule.instance,
      })),
    );
  }
  return { course, students, quizzes, assignments, ...state, sessions };
}

/**
 * Lượt làm trắc nghiệm — 1 lần gọi / (bài, sinh viên), hàm Moodle không có dạng cả lớp.
 * `includeStudent`: bỏ qua sinh viên chưa có trong EWARS (vẫn có trong `students` để đếm riêng).
 */
export async function fetchQuizAttempts(
  client: MoodleClient,
  base: MoodleCourseBase,
  includeStudent: (user: MoodleEnrolledUser) => boolean = () => true,
): Promise<MoodleCourseData['attempts']> {
  const attempts = new Map<number, Map<number, MoodleQuizAttempt[]>>();
  for (const quiz of base.quizzes) {
    const byUser = new Map<number, MoodleQuizAttempt[]>();
    for (const student of base.students.filter(includeStudent)) {
      const res = await get(client, 'mod_quiz_get_user_quiz_attempts', quizAttemptsSchema, {
        quizid: quiz.id,
        userid: student.id,
        status: 'all',
      });
      byUser.set(
        student.id,
        res.attempts.filter((a) => a.preview === 0),
      );
    }
    attempts.set(quiz.id, byUser);
  }
  return attempts;
}

export async function fetchMoodleCourse(
  client: MoodleClient,
  moodleCourseId: number,
  includeStudent: (user: MoodleEnrolledUser) => boolean = () => true,
): Promise<MoodleCourseData> {
  const base = await fetchMoodleCourseBase(client, moodleCourseId);
  return { ...base, attempts: await fetchQuizAttempts(client, base, includeStudent) };
}

/** Sổ điểm cả lớp — đổi khi sinh viên nộp bài trắc nghiệm / được chấm (dò thay đổi). */
export async function fetchGradeItems(
  client: MoodleClient,
  moodleCourseId: number,
): Promise<MoodleGradeItems> {
  return get(client, 'gradereport_user_get_grade_items', gradeItemsSchema, {
    courseid: moodleCourseId,
    userid: 0,
  });
}

const sortedEntries = <V>(map: Map<number, V>) => [...map.entries()].sort(([a], [b]) => a - b);

/**
 * Dấu vân tay của 1 khóa (thuần): phần rẻ + sổ điểm + danh sách MSSV EWARS khớp được (sinh viên mới
 * được nhập vào EWARS cũng làm đổi dấu vân tay). Chỉ dùng trường đã qua Zod → ổn định giữa các lần.
 */
export function courseFingerprint(
  base: MoodleCourseBase,
  grades: MoodleGradeItems,
  resolvedStudentIds: readonly string[],
): string {
  const payload = {
    course: base.course,
    students: base.students.map((s) => [s.id, s.idnumber ?? '', s.email ?? '']),
    resolved: [...resolvedStudentIds].sort(),
    quizzes: base.quizzes,
    assignments: base.assignments,
    submissions: sortedEntries(base.submissions).map(([id, m]) => [id, sortedEntries(m)]),
    extensions: sortedEntries(base.extensions).map(([id, m]) => [id, sortedEntries(m)]),
    sessions: base.sessions,
    grades: [...grades.usergrades]
      .sort((a, b) => a.userid - b.userid)
      .map((u) => [u.userid, u.gradeitems]),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
