/**
 * `npm run moodle:fixtures` — gọi đủ 11 hàm web service chỉ đọc trên Moodle demo và ghi phản hồi JSON
 * vào tests/fixtures/moodle/ (test Phase 10b chạy với máy chủ Moodle giả, KHÔNG cần Moodle thật).
 * Đồng thời là bài kiểm tra quyền: tài khoản dịch vụ phải đọc được dữ liệu của MỌI sinh viên.
 * Cần: `npm run moodle:setup` đã chạy (token trong .env), Moodle có 2 khóa học demo.
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMoodleClient, type MoodleParams } from '../src/modules/data-import/moodle/client';

const OUT_DIR = 'tests/fixtures/moodle';
const SPEC_PATH = 'docs/demo-data/moodle/moodle-demo.json';

interface Spec {
  students: { mssv: string }[];
  courses: { idnumber: string }[];
}
interface CourseRef {
  id: number;
  idnumber: string;
}
interface Module {
  modname: string;
  instance: number;
  name: string;
}
interface EnrolledUser {
  id: number;
  idnumber?: string;
  roles?: { shortname: string }[];
}

const baseUrl = process.env.MOODLE_BASE_URL;
const token = process.env.MOODLE_WS_TOKEN;
if (!baseUrl || !token)
  throw new Error('Thiếu MOODLE_BASE_URL / MOODLE_WS_TOKEN — chạy npm run moodle:setup trước.');
const client = createMoodleClient({ baseUrl, token });

/** Mọi lần gọi của 1 hàm gom vào 1 file: [{ params, response }]. */
const recorded = new Map<string, { params: MoodleParams; response: unknown }[]>();

async function call<T>(fn: string, params: MoodleParams = {}): Promise<T> {
  const response = await client.call<T>(fn, params).catch((error: unknown) => {
    throw new Error(
      `${fn}(${JSON.stringify(params)}): ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  const list = recorded.get(fn) ?? [];
  list.push({ params, response });
  recorded.set(fn, list);
  return response;
}

/** Sinh viên trong tình huống trắc nghiệm (docs/demo-data/moodle/gen_moodle_demo.py) + 1 sinh viên sạch. */
const QUIZ_SAMPLE_SUFFIXES = ['901', '905', '911', '917', '919'];

async function main(): Promise<void> {
  const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as Spec;
  await call('core_webservice_get_site_info');

  for (const { idnumber } of spec.courses) {
    const found = await call<{ courses: CourseRef[] }>('core_course_get_courses_by_field', {
      field: 'idnumber',
      value: idnumber,
    });
    const course = found.courses[0];
    if (!course)
      throw new Error(`Moodle không có khóa học ${idnumber} — chạy npm run moodle:setup`);
    const sections = await call<{ modules: Module[] }[]>('core_course_get_contents', {
      courseid: course.id,
    });
    const modules = sections.flatMap((s) => s.modules);
    const users = await call<EnrolledUser[]>('core_enrol_get_enrolled_users', {
      courseid: course.id,
    });
    // Moodle bỏ trường rỗng (giảng viên không có ID number) — chỉ sinh viên bắt buộc có.
    const students = users.filter((u) => u.roles?.some((r) => r.shortname === 'student'));
    const missingId = students.filter((u) => !u.idnumber).length;
    if (students.length === 0 || missingId > 0) {
      throw new Error(
        `${missingId}/${students.length} sinh viên thiếu idnumber — kiểm quyền moodle/site:viewuseridentity`,
      );
    }

    const quizzes = await call<{ quizzes: { id: number; name: string }[] }>(
      'mod_quiz_get_quizzes_by_courses',
      {
        courseids: [course.id],
      },
    );
    await call('gradereport_user_get_grade_items', { courseid: course.id, userid: 0 });
    const byMssv = new Map(users.map((u) => [u.idnumber ?? '', u.id]));
    for (const quiz of quizzes.quizzes) {
      for (const suffix of QUIZ_SAMPLE_SUFFIXES) {
        const userid = [...byMssv].find(([mssv]) => mssv.endsWith(suffix))?.[1];
        if (userid)
          await call('mod_quiz_get_user_quiz_attempts', { quizid: quiz.id, userid, status: 'all' });
      }
    }

    // Tài khoản dịch vụ không ghi danh vào khóa học → bắt buộc includenotenrolledcourses (nếu không Moodle
    // trả rỗng + cảnh báo "User is not enrolled").
    const assignments = await call<{ courses: { assignments: { id: number }[] }[] }>(
      'mod_assign_get_assignments',
      {
        courseids: [course.id],
        includenotenrolledcourses: true,
      },
    );
    const assignmentids = assignments.courses.flatMap((c) => c.assignments.map((a) => a.id));
    await call('mod_assign_get_submissions', { assignmentids });
    await call('mod_assign_get_user_flags', { assignmentids });

    const attendance = modules.find((m) => m.modname === 'attendance');
    if (!attendance) throw new Error(`${idnumber}: không có hoạt động Điểm danh`);
    const sessions = await call<unknown[]>('mod_attendance_get_sessions', {
      attendanceid: attendance.instance,
    });
    process.stdout.write(
      `  ${idnumber}: ${users.length} người, ${quizzes.quizzes.length} trắc nghiệm, ${assignmentids.length} thực hành, ${sessions.length} buổi\n`,
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const [fn, calls] of recorded) {
    writeFileSync(join(OUT_DIR, `${fn}.json`), `${JSON.stringify(calls, null, 2)}\n`);
  }
  process.stdout.write(
    `✔ ${recorded.size} hàm → ${OUT_DIR}/ (${spec.students.length} sinh viên demo)\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}\n`,
  );
  process.exit(1);
});
