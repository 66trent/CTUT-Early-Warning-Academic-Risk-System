/**
 * Dữ liệu Moodle demo (Phase 10a) — hàm thuần sinh "kịch bản" khóa học, điểm danh, trắc nghiệm, thực hành
 * cho script PHP `integrations/moodle/cli/ewars_seed_demo.php` (docs/huong-dan-moodle.md mục 3).
 *
 * NEO THEO NGÀY CHỐT DỮ LIỆU (`cutoff`, mặc định hôm qua): học kỳ demo theo ngày thật nên bài "chương 3"
 * phải luôn CHƯA tới hạn và 2 buổi vắng của 904 luôn là 2 buổi gần nhất — dựng lại sát ngày trình diễn
 * (`npm run moodle:setup -- --reset`) thì kết quả mong đợi không đổi. Bản ghi trong repo
 * (`docs/demo-data/moodle/moodle-demo.json`, `FIXTURE_CUTOFF`) dùng cho fixture/test.
 *
 * Giả định demo (không xác minh với trường — người dùng chốt 2026-11-07): học kỳ HK1_2026 17/08–27/12/2026;
 * lớp KTPM2411 (20 SV bộ v3) học Mạng máy tính (0101000892) + Hệ điều hành (0101000891), 60 tiết; mỗi tuần
 * 1 buổi 200 phút = 4 tiết (1 tiết = 50 phút) × 15 tuần; Course ID number = mã lớp học phần 12 số.
 * Sinh viên không có trong TINH_HUONG: đi học đủ, trắc nghiệm 7–10 điểm, nộp đúng hạn.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

export const MOODLE_DEMO_TERM = {
  termId: 'HK1_2026',
  termName: 'Học kỳ 1, 2026–2027',
  academicYear: '2026-2027',
  startDate: '2026-08-17',
  endDate: '2026-12-27',
} as const;

/** Ngày chốt của bản ghi trong repo (fixture `tests/fixtures/moodle/`). */
export const FIXTURE_CUTOFF = '2026-11-06';

const CLASS_ID = 'KTPM2411';
const WEEKS = 15;
const SESSION_MINUTES = 200;
/** Cần ≥ 12 buổi đã điểm danh ở cả 2 học phần (tình huống vắng ở tuần 3–12). */
export const MIN_CUTOFF = '2026-11-05';
export const MAX_CUTOFF = '2026-12-20';

export interface DemoStudent {
  mssv: string;
  username: string;
  lastname: string;
  firstname: string;
  email: string;
}
export interface DemoSession {
  start: string;
  durationMinutes: number;
  taken: boolean;
  /** MSSV → ký hiệu P/L/E/A (chỉ khi `taken`). */
  statuses: Record<string, 'P' | 'L' | 'E' | 'A'>;
}
export interface DemoAttempt {
  mssv: string;
  attempt: number;
  start: string;
  finish: string | null;
  correct: number | null;
}
export interface DemoQuiz {
  key: string;
  name: string;
  open: string;
  due: string;
  questions: number;
  attempts: DemoAttempt[];
}
export interface DemoAssignment {
  key: string;
  name: string;
  open: string;
  due: string;
  submissions: { mssv: string; submittedAt: string }[];
  extensions: { mssv: string; until: string }[];
}
export interface DemoCourse {
  idnumber: string;
  courseCode: string;
  shortname: string;
  fullname: string;
  attendance: { name: string; sessions: DemoSession[] };
  quizzes: DemoQuiz[];
  assignments: DemoAssignment[];
}
export interface MoodleDemoSpec {
  note: string;
  term: typeof MOODLE_DEMO_TERM;
  dataCutoff: string;
  category: string;
  teacher: { username: string; firstname: string; lastname: string; email: string };
  students: DemoStudent[];
  courses: DemoCourse[];
}

// ── Ngày (chỉ ngày lịch, giờ Việt Nam ghi kèm +07:00) ──────────────────────
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function minDate(a: string, b: string): string {
  return a < b ? a : b;
}
function vn(isoDate: string, hh: number, mm = 0): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const total = hh * 60 + mm;
  return `${isoDate}T${pad(Math.floor(total / 60))}:${pad(total % 60)}:00+07:00`;
}

type Mark = 'E' | 'A';
interface Situation {
  /** Vắng theo tuần (1..15) — `last: n` = n buổi đã điểm danh gần nhất. */
  absent: Record<string, Record<number, Mark> | { last: number; mark: Mark }>;
  quizSkip: Record<string, string[]>;
  quizScores: Record<string, Record<string, number[]>>;
  quizInProgress: Record<string, string>;
  assignMissing: Record<string, string[]>;
  assignLate: Record<string, string[]>;
  /** Gia hạn: số ngày SAU ngày chốt (luôn còn hạn). */
  extension: Record<string, { key: string; daysAfterCutoff: number }>;
}

/** Tình huống theo học phần — 3 số cuối MSSV. Kết quả mong đợi: docs/huong-dan-moodle.md mục 3. */
const TINH_HUONG: Record<'MMT' | 'HDH', Situation> = {
  MMT: {
    absent: {
      '903': { 3: 'A', 6: 'A', 9: 'A', 12: 'A' }, // 16/60 tiết = 26,7% → ATT-01 Rất cao
      '906': { 5: 'E', 8: 'E' }, // 8/60 = 13,3% có phép → ATT-01 TB
    },
    quizSkip: {},
    quizScores: {},
    quizInProgress: { '917': 'TN02' }, // làm dở, quá hạn không nộp → LMS-01 TB
    assignMissing: { '907': ['TH01', 'TH02'] }, // → LMS-03 Cao
    assignLate: { '909': ['TH01', 'TH02'] }, // → LMS-04 Thấp
    extension: { '915': { key: 'TH02', daysAfterCutoff: 7 } }, // gia hạn, chưa nộp → KHÔNG cảnh báo
  },
  HDH: {
    absent: {
      '904': { last: 2, mark: 'A' }, // 2 buổi gần nhất: 13,3% + tăng 8 tiết/14 ngày → ATT-01 TB + ATT-02
      '913': { 4: 'A', 7: 'A' }, // 13,3% (TB) …
    },
    quizSkip: { '905': ['TN01', 'TN02'] }, // → LMS-01 Cao
    quizScores: {
      '911': { TN01: [4], TN02: [3] }, // 2 bài gần nhất < 50% → LMS-02 TB
      '919': { TN01: [5, 9] }, // 2 lượt, lấy lượt cao nhất → không cảnh báo
    },
    quizInProgress: {},
    assignMissing: { '913': ['TH01'] }, // … + bỏ 1 bài thực hành → COMB-01 Rất cao
    assignLate: {},
    extension: {},
  },
};

const COURSES = [
  {
    key: 'MMT',
    idnumber: '010100089201',
    courseCode: '0101000892',
    name: 'Mạng máy tính',
    first: '2026-08-18',
    hour: 7,
  },
  {
    key: 'HDH',
    idnumber: '010100089101',
    courseCode: '0101000891',
    name: 'Hệ điều hành',
    first: '2026-08-20',
    hour: 13,
  },
] as const;

/** Bài 1, 2 hạn cố định trong quá khứ; bài 3 hạn = ngày chốt + N ngày (luôn chưa tới hạn). */
function quizzes(cutoff: string) {
  return [
    { key: 'TN01', name: 'Trắc nghiệm chương 1', open: '2026-09-08', due: '2026-09-15' },
    { key: 'TN02', name: 'Trắc nghiệm chương 2', open: '2026-10-06', due: '2026-10-13' },
    {
      key: 'TN03',
      name: 'Trắc nghiệm chương 3',
      open: addDays(cutoff, 3),
      due: minDate(addDays(cutoff, 10), MOODLE_DEMO_TERM.endDate),
    },
  ];
}
function assignments(cutoff: string) {
  return [
    { key: 'TH01', name: 'Thực hành 1', open: '2026-09-08', due: '2026-09-22' },
    { key: 'TH02', name: 'Thực hành 2', open: '2026-10-06', due: '2026-10-20' },
    {
      key: 'TH03',
      name: 'Thực hành 3',
      open: addDays(cutoff, -4),
      due: minDate(addDays(cutoff, 14), MOODLE_DEMO_TERM.endDate),
    },
  ];
}

function readStudents(csvPath: string): DemoStudent[] {
  const rows = parse<Record<string, string>>(readFileSync(csvPath, 'utf8'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });
  return rows
    .filter((r) => r.ma_lop_sinh_hoat === CLASS_ID)
    .map((r) => {
      const mssv = r.mssv ?? '';
      const parts = (r.ho_ten ?? '').trim().split(/\s+/);
      return {
        mssv,
        username: mssv.toLowerCase(),
        lastname: parts.slice(0, -1).join(' '),
        firstname: parts.at(-1) ?? '',
        email: r.email ?? '',
      };
    });
}

function buildCourse(
  c: (typeof COURSES)[number],
  studs: DemoStudent[],
  cutoff: string,
): DemoCourse {
  const th = TINH_HUONG[c.key];
  const dates = Array.from({ length: WEEKS }, (_, i) => addDays(c.first, i * 7));
  const takenCount = dates.filter((d) => d <= cutoff).length;
  const markOf = (mssv: string, week: number): 'P' | Mark => {
    const rule = th.absent[mssv.slice(-3)];
    if (!rule) return 'P';
    if ('last' in rule) return week > takenCount - rule.last ? rule.mark : 'P';
    return rule[week] ?? 'P';
  };
  const sessions: DemoSession[] = dates.map((d, i) => {
    const taken = d <= cutoff;
    const statuses: DemoSession['statuses'] = {};
    if (taken) for (const s of studs) statuses[s.mssv] = markOf(s.mssv, i + 1);
    return { start: vn(d, c.hour), durationMinutes: SESSION_MINUTES, taken, statuses };
  });

  const quizList: DemoQuiz[] = quizzes(cutoff).map((q, qi) => {
    const attempts: DemoAttempt[] = [];
    if (q.due <= cutoff) {
      studs.forEach((s, si) => {
        const suf = s.mssv.slice(-3);
        if (th.quizSkip[suf]?.includes(q.key)) return;
        const day = addDays(q.due, -(1 + (si % 3)));
        if (th.quizInProgress[suf] === q.key) {
          attempts.push({
            mssv: s.mssv,
            attempt: 1,
            start: vn(day, 20, si),
            finish: null,
            correct: null,
          });
          return;
        }
        const scores = th.quizScores[suf]?.[q.key] ?? [7 + ((si + qi) % 4)];
        scores.forEach((correct, n) => {
          const t0 = addDays(day, -(scores.length - 1 - n));
          attempts.push({
            mssv: s.mssv,
            attempt: n + 1,
            start: vn(t0, 20, si),
            finish: vn(t0, 20, si + 20),
            correct,
          });
        });
      });
    }
    return {
      key: q.key,
      name: q.name,
      open: vn(q.open, 0),
      due: vn(q.due, 23, 59),
      questions: 10,
      attempts,
    };
  });

  const assignList: DemoAssignment[] = assignments(cutoff).map((a) => {
    const submissions: DemoAssignment['submissions'] = [];
    const extensions: DemoAssignment['extensions'] = [];
    studs.forEach((s, si) => {
      const suf = s.mssv.slice(-3);
      const ext = th.extension[suf];
      if (ext?.key === a.key) {
        extensions.push({ mssv: s.mssv, until: vn(addDays(cutoff, ext.daysAfterCutoff), 23, 59) });
        return;
      }
      if (th.assignMissing[suf]?.includes(a.key)) return;
      if (th.assignLate[suf]?.includes(a.key)) {
        submissions.push({ mssv: s.mssv, submittedAt: vn(addDays(a.due, 2), 21) });
      } else if (a.due <= cutoff) {
        submissions.push({
          mssv: s.mssv,
          submittedAt: vn(addDays(a.due, -(1 + (si % 4))), 19, si),
        });
      } else if (suf === '901' || suf === '902') {
        submissions.push({ mssv: s.mssv, submittedAt: vn(addDays(cutoff, -1), 21) }); // nộp sớm bài chưa tới hạn
      }
    });
    return {
      key: a.key,
      name: a.name,
      open: vn(a.open, 0),
      due: vn(a.due, 23, 59),
      submissions,
      extensions,
    };
  });

  const group = c.idnumber.slice(-2);
  return {
    idnumber: c.idnumber,
    courseCode: c.courseCode,
    shortname: `${c.key}-${group}-HK1-2026`,
    fullname: `${c.name} (nhóm ${group}) — HK1 2026–2027`,
    attendance: { name: 'Điểm danh', sessions },
    quizzes: quizList,
    assignments: assignList,
  };
}

/** Sinh kịch bản Moodle demo với ngày chốt `cutoff` (`YYYY-MM-DD`, trong [MIN_CUTOFF, MAX_CUTOFF]). */
export function buildMoodleDemoSpec(
  cutoff: string,
  studentsCsv = 'docs/demo-data/01_sinh_vien.csv',
): MoodleDemoSpec {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) throw new Error(`Ngày chốt không hợp lệ: ${cutoff}`);
  if (cutoff < MIN_CUTOFF || cutoff > MAX_CUTOFF) {
    throw new Error(
      `Ngày chốt ${cutoff} ngoài khoảng ${MIN_CUTOFF} – ${MAX_CUTOFF} của học kỳ demo ${MOODLE_DEMO_TERM.termId} ` +
        `(cần ≥ 12 buổi đã học và bài chương 3 còn hạn trước cuối học kỳ). Dùng --cutoff=YYYY-MM-DD.`,
    );
  }
  const studs = readStudents(studentsCsv);
  if (studs.length !== 20)
    throw new Error(`Lớp ${CLASS_ID} cần 20 sinh viên, đọc được ${studs.length}`);
  return {
    note: 'Sinh bởi scripts/lib/moodle-demo-spec.ts — đừng sửa tay.',
    term: MOODLE_DEMO_TERM,
    dataCutoff: cutoff,
    category: 'HK1 2026–2027',
    teacher: {
      username: 'gv.moodle',
      firstname: 'Demo',
      lastname: 'Giảng viên',
      email: 'gv.moodle@moodle.local',
    },
    students: studs,
    courses: COURSES.map((c) => buildCourse(c, studs, cutoff)),
  };
}

/** Hôm qua theo giờ Việt Nam (`YYYY-MM-DD`) — mặc định của ngày chốt khi dựng Moodle demo. */
export function yesterdayVn(now = new Date()): string {
  return addDays(new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10), -1);
}
