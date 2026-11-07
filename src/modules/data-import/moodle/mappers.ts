/**
 * Mapper THUẦN: dữ liệu 1 khóa học Moodle → các dòng đúng cột mẫu file (public/templates/*.csv) của 3
 * nguồn — để đồng bộ dùng lại 100% kiểm tra dòng + ghi của đường nạp file (docs/tich-hop-moodle.md mục 3).
 * Không DB, không mạng.
 */
import { type MoodleUnknownStudent } from '@/db/entities/moodle-course-link.entity';
import { type MoodleCourseData } from './fetch-course';
import { type MoodleEnrolledUser } from './schemas';

export type CsvRow = Record<string, string>;

export const ATTENDANCE_COLUMNS = [
  'mssv',
  'ma_lop_hoc_phan',
  'ma_hoc_phan',
  'ten_hoc_phan',
  'ngay_chot',
  'tong_so_tiet',
  'vang_co_phep',
  'vang_khong_phep',
] as const;
export const QUIZ_COLUMNS = [
  'mssv',
  'ma_lop_hoc_phan',
  'ma_hoc_phan',
  'ten_hoc_phan',
  'ma_bai',
  'ten_bai',
  'han_nop',
  'lan_lam',
  'thoi_diem_bat_dau',
  'thoi_diem_nop',
  'thoi_gian_lam_phut',
  'diem',
  'diem_toi_da',
  'trang_thai',
] as const;
export const ASSIGNMENT_COLUMNS = [
  'mssv',
  'ma_lop_hoc_phan',
  'ma_hoc_phan',
  'ten_hoc_phan',
  'ma_bai',
  'ten_bai',
  'han_nop',
  'trang_thai_nop',
  'thoi_diem_nop',
  'han_rieng',
] as const;

export interface MoodleLinkInfo {
  sectionCode: string;
  courseId: string;
  courseName: string;
  totalPeriodsOverride: number | null;
}

export interface MoodleMappingOptions {
  /** Số phút 1 tiết (người dùng xác nhận 50). */
  periodMinutes: number;
  /** Ký hiệu trạng thái điểm danh tính là vắng có phép / không phép (mặc định E / A). */
  excused: ReadonlySet<string>;
  unexcused: ReadonlySet<string>;
}

/** MSSV của 1 người dùng Moodle trong EWARS (ID number = MSSV, dự phòng email đã lưu), không có → null. */
export type StudentResolver = (user: MoodleEnrolledUser) => string | null;

export interface MappedCourse {
  attendance: CsvRow[];
  quiz: CsvRow[];
  assignment: CsvRow[];
  unknownStudents: MoodleUnknownStudent[];
  notes: string[];
}

const VN_OFFSET_MS = 7 * 3600_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Unix giây → `YYYY-MM-DD` giờ Việt Nam. */
export function vnDate(unix: number): string {
  return new Date(unix * 1000 + VN_OFFSET_MS).toISOString().slice(0, 10);
}
/** Unix giây → `YYYY-MM-DD HH:mm` giờ Việt Nam (định dạng cột thời điểm của mẫu file). */
export function vnDateTime(unix: number): string {
  const d = new Date(unix * 1000 + VN_OFFSET_MS);
  return `${d.toISOString().slice(0, 10)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
const round = (value: number, digits: number) => Number(value.toFixed(digits)).toString();

function base(link: MoodleLinkInfo, mssv: string): CsvRow {
  return {
    mssv,
    ma_lop_hoc_phan: link.sectionCode,
    ma_hoc_phan: link.courseId,
    ten_hoc_phan: link.courseName,
  };
}

/** Số tiết của 1 buổi = thời lượng ÷ số phút 1 tiết (làm tròn, tối thiểu 1). */
export function periodsOf(durationSeconds: number, periodMinutes: number): number {
  return Math.max(1, Math.round(durationSeconds / 60 / periodMinutes));
}

/**
 * Điểm danh: 1 ngày chốt cho MỖI NGÀY có buổi đã điểm danh, số tiết vắng cộng dồn đến hết ngày đó
 * (ATT-02 so với ngày chốt cũ nhất trong 14 ngày — docs/rules/08). Tổng số tiết = mọi buổi đã tạo.
 * Buổi theo nhóm được tính cho cả lớp (giới hạn đã biết); sinh viên không có trạng thái ở 1 buổi đã
 * điểm danh → không tính vắng.
 */
function mapAttendance(
  data: MoodleCourseData,
  link: MoodleLinkInfo,
  students: ReadonlyMap<number, string>,
  opts: MoodleMappingOptions,
  notes: string[],
): CsvRow[] {
  if (data.sessions.length === 0) return [];
  const sessions = [...data.sessions].sort((a, b) => a.sessdate - b.sessdate);
  const total =
    link.totalPeriodsOverride ??
    sessions.reduce((sum, s) => sum + periodsOf(s.duration, opts.periodMinutes), 0);
  const taken = sessions.filter((s) => s.attendance_log.length > 0);
  if (taken.length === 0) {
    notes.push('Điểm danh: chưa có buổi nào được điểm danh.');
    return [];
  }
  const dates = [...new Set(taken.map((s) => vnDate(s.sessdate)))].sort();
  const rows: CsvRow[] = [];
  for (const [userId, mssv] of students) {
    let excused = 0;
    let unexcused = 0;
    let i = 0;
    for (const date of dates) {
      for (; i < taken.length && vnDate(taken[i].sessdate) <= date; i += 1) {
        const session = taken[i];
        const log = session.attendance_log.find((l) => l.studentid === userId);
        const acronym = session.statuses.find((st) => st.id === log?.statusid)?.acronym ?? '';
        const periods = periodsOf(session.duration, opts.periodMinutes);
        if (opts.excused.has(acronym)) excused += periods;
        else if (opts.unexcused.has(acronym)) unexcused += periods;
      }
      rows.push({
        ...base(link, mssv),
        ngay_chot: date,
        tong_so_tiet: String(total),
        vang_co_phep: String(excused),
        vang_khong_phep: String(unexcused),
      });
    }
  }
  return rows;
}

const QUIZ_STATE_LABEL: Record<string, string> = {
  finished: 'Đã nộp',
  inprogress: 'Đang làm',
  overdue: 'Đang làm',
  abandoned: 'Bỏ dở',
};

/** Trắc nghiệm: mỗi lượt 1 dòng; sinh viên chưa có lượt nào = 1 dòng "Chưa làm" (biết chắc ai bỏ bài). */
function mapQuizzes(
  data: MoodleCourseData,
  link: MoodleLinkInfo,
  students: ReadonlyMap<number, string>,
  notes: string[],
): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const quiz of data.quizzes) {
    const due = quiz.duedate || quiz.timeclose;
    if (!due)
      notes.push(
        `Trắc nghiệm "${quiz.name}" không có hạn nộp — luật dùng cách "đa số lớp đã làm".`,
      );
    const scaled = quiz.sumgrades > 0;
    const activity = {
      ma_bai: `Q${quiz.id}`,
      ten_bai: quiz.name.slice(0, 200),
      han_nop: due ? vnDateTime(due) : '',
    };
    for (const [userId, mssv] of students) {
      const attempts = data.attempts.get(quiz.id)?.get(userId) ?? [];
      if (attempts.length === 0) {
        rows.push({ ...base(link, mssv), ...activity, trang_thai: 'Chưa làm' });
        continue;
      }
      for (const a of attempts) {
        const finished = a.state === 'finished';
        const score =
          finished && a.sumgrades !== null && a.sumgrades !== undefined
            ? round(scaled ? (a.sumgrades / quiz.sumgrades) * quiz.grade : a.sumgrades, 2)
            : '';
        rows.push({
          ...base(link, mssv),
          ...activity,
          lan_lam: String(a.attempt),
          thoi_diem_bat_dau: vnDateTime(a.timestart),
          thoi_diem_nop: finished && a.timefinish ? vnDateTime(a.timefinish) : '',
          thoi_gian_lam_phut:
            finished && a.timefinish ? round((a.timefinish - a.timestart) / 60, 1) : '',
          diem: score,
          diem_toi_da: scaled ? round(quiz.grade, 2) : '',
          trang_thai: QUIZ_STATE_LABEL[a.state] ?? 'Đang làm',
        });
      }
    }
  }
  return rows;
}

/**
 * Thực hành: mỗi (bài, sinh viên) 1 dòng. `submitted` → Đã nộp / Nộp trễ so với hạn (hạn gia hạn riêng
 * nếu có); bản nháp / chưa có → Chưa nộp. Gia hạn riêng (Grant extension) ghi cột `han_rieng` → LMS-03
 * không tính "không nộp" khi hạn riêng chưa qua, LMS-04 so với hạn riêng (docs/rules/08, 10).
 */
function mapAssignments(
  data: MoodleCourseData,
  link: MoodleLinkInfo,
  students: ReadonlyMap<number, string>,
  notes: string[],
): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const a of data.assignments) {
    if (!a.duedate) {
      notes.push(
        `Thực hành "${a.name}" không có hạn nộp (Due date) — bỏ qua, hãy đặt hạn nộp trên Moodle.`,
      );
      continue;
    }
    const activity = {
      ma_bai: `A${a.id}`,
      ten_bai: a.name.slice(0, 200),
      han_nop: vnDateTime(a.duedate),
    };
    for (const [userId, mssv] of students) {
      const sub = data.submissions.get(a.id)?.get(userId);
      const extension = data.extensions.get(a.id)?.get(userId);
      const submitted = sub?.status === 'submitted';
      const late = submitted && sub.timemodified > (extension ?? a.duedate);
      rows.push({
        ...base(link, mssv),
        ...activity,
        trang_thai_nop: submitted ? (late ? 'Nộp trễ' : 'Đã nộp') : 'Chưa nộp',
        thoi_diem_nop: submitted ? vnDateTime(sub.timemodified) : '',
        han_rieng: extension ? vnDateTime(extension) : '',
      });
    }
  }
  return rows;
}

export function mapMoodleCourse(
  data: MoodleCourseData,
  link: MoodleLinkInfo,
  resolve: StudentResolver,
  opts: MoodleMappingOptions,
): MappedCourse {
  const students = new Map<number, string>();
  const unknownStudents: MoodleUnknownStudent[] = [];
  for (const user of data.students) {
    const mssv = resolve(user);
    if (mssv) students.set(user.id, mssv);
    else
      unknownStudents.push({
        moodleUserId: user.id,
        idnumber: user.idnumber?.trim() || null,
        email: user.email?.trim() || null,
      });
  }
  const notes: string[] = [];
  return {
    attendance: mapAttendance(data, link, students, opts, notes),
    quiz: mapQuizzes(data, link, students, notes),
    assignment: mapAssignments(data, link, students, notes),
    unknownStudents,
    notes,
  };
}

/** Ghép dòng thành CSV (UTF-8 có BOM như mẫu file; trường có dấu phẩy/nháy/xuống dòng được bọc nháy). */
export function toCsv(columns: readonly string[], rows: readonly CsvRow[]): Buffer {
  const cell = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [
    columns.join(','),
    ...rows.map((r) => columns.map((c) => cell(r[c] ?? '')).join(',')),
  ];
  return Buffer.from(`﻿${lines.join('\n')}\n`, 'utf8');
}
