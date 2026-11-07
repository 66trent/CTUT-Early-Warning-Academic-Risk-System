import { describe, expect, it } from 'vitest';
import { type MoodleCourseData } from '@/modules/data-import/moodle/fetch-course';
import {
  mapMoodleCourse,
  periodsOf,
  toCsv,
  vnDate,
  vnDateTime,
} from '@/modules/data-import/moodle/mappers';
import { lmsAssignmentImport } from '@/modules/data-import/types/lms-assignment.import';

/** Unix giây của 1 thời điểm giờ Việt Nam. */
const t = (iso: string) => Math.floor(new Date(`${iso}+07:00`).getTime() / 1000);
const opts = { periodMinutes: 50, excused: new Set(['E']), unexcused: new Set(['A']) };
const link = {
  sectionCode: '010100089201',
  courseId: '0101000892',
  courseName: 'Mạng máy tính',
  totalPeriodsOverride: null,
};
const STATUSES = [
  { id: 1, acronym: 'P' },
  { id: 2, acronym: 'L' },
  { id: 3, acronym: 'E' },
  { id: 4, acronym: 'A' },
];

function course(over: Partial<MoodleCourseData> = {}): MoodleCourseData {
  return {
    course: {
      id: 7,
      shortname: 'MMT',
      fullname: 'Mạng máy tính',
      idnumber: '010100089201',
      startdate: 0,
      enddate: 0,
    },
    students: [
      {
        id: 11,
        idnumber: 'KTPM2411901',
        email: 'a@student.ctuet.edu.vn',
        roles: [{ shortname: 'student' }],
      },
      { id: 12, idnumber: '', email: 'b@student.ctuet.edu.vn', roles: [{ shortname: 'student' }] },
      { id: 13, idnumber: 'KHAC001', email: 'c@x.vn', roles: [{ shortname: 'student' }] },
    ],
    quizzes: [],
    attempts: new Map(),
    assignments: [],
    submissions: new Map(),
    extensions: new Map(),
    sessions: [],
    ...over,
  };
}
// 11 khớp ID number, 12 khớp email đã lưu, 13 chưa có trong EWARS.
const resolve = (u: { idnumber?: string; email?: string }) =>
  u.idnumber === 'KTPM2411901'
    ? 'KTPM2411901'
    : u.email === 'b@student.ctuet.edu.vn'
      ? 'KTPM2411902'
      : null;

describe('Moodle → mẫu file — chung', () => {
  it('giờ Việt Nam; số tiết = thời lượng ÷ 50 phút (làm tròn, tối thiểu 1)', () => {
    expect(vnDate(t('2026-11-05T23:30:00'))).toBe('2026-11-05');
    expect(vnDateTime(t('2026-11-05T07:05:00'))).toBe('2026-11-05 07:05');
    expect([periodsOf(12_000, 50), periodsOf(9_000, 50), periodsOf(600, 50)]).toEqual([4, 3, 1]);
  });

  it('sinh viên chưa có trong EWARS: bỏ qua, đếm riêng; khớp email khi ID number trống', () => {
    const mapped = mapMoodleCourse(
      course({
        quizzes: [
          { id: 5, course: 7, name: 'TN', timeopen: 0, timeclose: 0, grade: 10, sumgrades: 10 },
        ],
      }),
      link,
      resolve,
      opts,
    );
    expect(mapped.quiz.map((r) => r.mssv)).toEqual(['KTPM2411901', 'KTPM2411902']);
    expect(mapped.unknownStudents).toEqual([
      { moodleUserId: 13, idnumber: 'KHAC001', email: 'c@x.vn' },
    ]);
    expect(mapped.notes[0]).toMatch(/không có hạn nộp/);
  });

  it('CSV: BOM + bọc nháy trường có dấu phẩy / nháy', () => {
    const csv = toCsv(['a', 'b'], [{ a: 'x, y', b: 'nói "ok"' }]).toString('utf8');
    expect(csv).toBe('﻿a,b\n"x, y","nói ""ok"""\n');
  });
});

describe('Moodle → điểm danh (tiết, cộng dồn theo ngày)', () => {
  const session = (id: number, start: string, minutes: number, logs: [number, number][]) => ({
    id,
    groupid: 0,
    sessdate: t(start),
    duration: minutes * 60,
    statuses: STATUSES,
    attendance_log: logs.map(([studentid, statusid]) => ({ studentid, statusid })),
  });

  it('1 ngày chốt / ngày có buổi đã điểm danh; 2 buổi cùng ngày gộp; E có phép, A không phép, L có mặt', () => {
    const mapped = mapMoodleCourse(
      course({
        sessions: [
          session(1, '2026-09-01T07:00:00', 200, [
            [11, 4],
            [12, 1],
          ]),
          session(2, '2026-09-08T07:00:00', 150, [
            [11, 2],
            [12, 3],
          ]),
          session(3, '2026-09-08T13:00:00', 100, [
            [11, 4],
            [12, 1],
          ]),
          session(4, '2026-09-15T07:00:00', 200, []), // chưa điểm danh: vào tổng tiết, không thành ngày chốt
        ],
      }),
      link,
      resolve,
      opts,
    );
    expect(
      mapped.attendance.map((r) => [
        r.mssv,
        r.ngay_chot,
        r.tong_so_tiet,
        r.vang_co_phep,
        r.vang_khong_phep,
      ]),
    ).toEqual([
      ['KTPM2411901', '2026-09-01', '13', '0', '4'],
      ['KTPM2411901', '2026-09-08', '13', '0', '6'],
      ['KTPM2411902', '2026-09-01', '13', '0', '0'],
      ['KTPM2411902', '2026-09-08', '13', '3', '0'],
    ]);
  });

  it('Admin ghi đè tổng số tiết; chưa có buổi nào điểm danh → không sinh dòng, có ghi chú', () => {
    const sessions = [session(1, '2026-09-01T07:00:00', 200, [[11, 4]])];
    const withOverride = mapMoodleCourse(
      course({ sessions }),
      { ...link, totalPeriodsOverride: 45 },
      resolve,
      opts,
    );
    expect(withOverride.attendance[0]?.tong_so_tiet).toBe('45');
    const none = mapMoodleCourse(
      course({ sessions: [session(1, '2026-09-01T07:00:00', 200, [])] }),
      link,
      resolve,
      opts,
    );
    expect(none.attendance).toEqual([]);
    expect(none.notes).toContain('Điểm danh: chưa có buổi nào được điểm danh.');
  });
});

describe('Moodle → trắc nghiệm', () => {
  it('điểm quy về thang grade; lượt làm dở / bỏ dở / chưa làm; hạn = duedate (5.3) rồi tới timeclose', () => {
    const attempts = new Map([
      [
        5,
        new Map([
          [
            11,
            [
              {
                id: 1,
                userid: 11,
                attempt: 1,
                state: 'finished',
                preview: 0,
                timestart: t('2026-09-14T20:00:00'),
                timefinish: t('2026-09-14T20:25:00'),
                sumgrades: 15,
              },
            ],
          ],
          [
            12,
            [
              {
                id: 2,
                userid: 12,
                attempt: 1,
                state: 'abandoned',
                preview: 0,
                timestart: t('2026-09-14T21:00:00'),
                timefinish: 0,
                sumgrades: null,
              },
            ],
          ],
        ]),
      ],
      [6, new Map()],
    ]);
    const mapped = mapMoodleCourse(
      course({
        quizzes: [
          {
            id: 5,
            course: 7,
            name: 'TN01',
            timeopen: 0,
            timeclose: t('2026-09-20T23:59:00'),
            duedate: t('2026-09-15T23:59:00'),
            grade: 10,
            sumgrades: 20,
          },
          {
            id: 6,
            course: 7,
            name: 'TN02',
            timeopen: 0,
            timeclose: t('2026-10-20T23:59:00'),
            grade: 10,
            sumgrades: 10,
          },
        ],
        attempts,
      }),
      link,
      resolve,
      opts,
    );
    expect(
      mapped.quiz.map((r) => [
        r.ma_bai,
        r.mssv,
        r.han_nop,
        r.trang_thai,
        r.diem,
        r.diem_toi_da,
        r.thoi_gian_lam_phut,
      ]),
    ).toEqual([
      ['Q5', 'KTPM2411901', '2026-09-15 23:59', 'Đã nộp', '7.5', '10', '25'],
      ['Q5', 'KTPM2411902', '2026-09-15 23:59', 'Bỏ dở', '', '10', ''],
      ['Q6', 'KTPM2411901', '2026-10-20 23:59', 'Chưa làm', undefined, undefined, undefined],
      ['Q6', 'KTPM2411902', '2026-10-20 23:59', 'Chưa làm', undefined, undefined, undefined],
    ]);
  });
});

describe('Moodle → thực hành', () => {
  it('nộp ≤ hạn Đã nộp, > hạn Nộp trễ, nháp = Chưa nộp; gia hạn ghi han_rieng và tính trễ theo hạn riêng', () => {
    const due = t('2026-09-22T23:59:00');
    const mapped = mapMoodleCourse(
      course({
        assignments: [
          { id: 9, name: 'TH01', duedate: due, cutoffdate: 0, allowsubmissionsfromdate: 0 },
          {
            id: 10,
            name: 'TH02 không hạn',
            duedate: 0,
            cutoffdate: 0,
            allowsubmissionsfromdate: 0,
          },
        ],
        submissions: new Map([
          [
            9,
            new Map([
              [11, { userid: 11, status: 'submitted', timemodified: t('2026-09-24T21:00:00') }],
              [12, { userid: 12, status: 'draft', timemodified: t('2026-09-20T10:00:00') }],
            ]),
          ],
        ]),
        extensions: new Map([[9, new Map([[11, t('2026-09-25T23:59:00')]])]]),
      }),
      link,
      resolve,
      opts,
    );
    expect(
      mapped.assignment.map((r) => [r.mssv, r.trang_thai_nop, r.thoi_diem_nop, r.han_rieng]),
    ).toEqual([
      ['KTPM2411901', 'Đã nộp', '2026-09-24 21:00', '2026-09-25 23:59'],
      ['KTPM2411902', 'Chưa nộp', '', ''],
    ]);
    expect(mapped.notes.some((n) => n.includes('TH02 không hạn'))).toBe(true);
  });

  it('cột han_rieng đọc được ở bộ nhập file thực hành; Đã nộp sau hạn chung nhưng trong hạn riêng không bị cảnh báo lệch', () => {
    const parsed = lmsAssignmentImport.parseRow(
      {
        mssv: 'KTPM2411901',
        ma_lop_hoc_phan: '010100089201',
        ma_bai: 'A9',
        ten_bai: 'TH01',
        han_nop: '2026-09-22 23:59',
        trang_thai_nop: 'Đã nộp',
        thoi_diem_nop: '2026-09-24 21:00',
        han_rieng: '2026-09-25',
      },
      { decimalComma: false },
    );
    expect(parsed.ok && parsed.value.extendedDueAt).toBe('2026-09-25T23:59:00+07:00');
    expect(parsed.ok && parsed.warnings).toEqual([]);
  });
});
