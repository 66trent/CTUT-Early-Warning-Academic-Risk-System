import { describe, expect, it } from 'vitest';
import {
  buildMoodleDemoSpec,
  FIXTURE_CUTOFF,
  MAX_CUTOFF,
  MIN_CUTOFF,
  yesterdayVn,
} from '../../../scripts/lib/moodle-demo-spec';

const day = (iso: string) => iso.slice(0, 10);

describe('Kịch bản Moodle demo — neo theo ngày chốt (Phase 10a)', () => {
  it.each([MIN_CUTOFF, FIXTURE_CUTOFF, '2026-12-01', MAX_CUTOFF])(
    'ngày chốt %s: bài chương 3 chưa tới hạn, gia hạn còn hiệu lực, chỉ buổi ≤ ngày chốt được điểm danh',
    (cutoff) => {
      const spec = buildMoodleDemoSpec(cutoff);
      expect(spec.students).toHaveLength(20);
      for (const course of spec.courses) {
        const sessions = course.attendance.sessions;
        expect(sessions).toHaveLength(15);
        expect(sessions.every((s) => s.taken === day(s.start) <= cutoff)).toBe(true);
        expect(sessions.filter((s) => s.taken).length).toBeGreaterThanOrEqual(12);
        const futureQuiz = course.quizzes.find((q) => q.key === 'TN03');
        const futureAssign = course.assignments.find((a) => a.key === 'TH03');
        expect(day(futureQuiz?.due ?? '') > cutoff).toBe(true);
        expect(day(futureAssign?.due ?? '') > cutoff).toBe(true);
        expect(futureQuiz?.attempts).toHaveLength(0);
        for (const a of course.assignments) {
          for (const e of a.extensions) expect(day(e.until) > cutoff).toBe(true);
        }
        // Mọi mốc nằm trong học kỳ demo.
        const all = [
          ...sessions.map((s) => s.start),
          ...course.quizzes.flatMap((q) => [q.open, q.due]),
          ...course.assignments.flatMap((a) => [a.open, a.due]),
        ].map(day);
        expect(all.every((d) => d >= spec.term.startDate && d <= spec.term.endDate)).toBe(true);
      }
    },
  );

  it('904 (Hệ điều hành) vắng không phép đúng 2 buổi gần ngày chốt nhất, dù dựng ngày nào', () => {
    for (const cutoff of [FIXTURE_CUTOFF, '2026-12-10']) {
      const hdh = buildMoodleDemoSpec(cutoff).courses.find((c) => c.idnumber === '010100089101');
      const taken = hdh?.attendance.sessions.filter((s) => s.taken) ?? [];
      const absent = taken.filter((s) => s.statuses.KTPM2411904 === 'A');
      expect(absent.map((s) => s.start)).toEqual(taken.slice(-2).map((s) => s.start));
    }
  });

  it('903 (Mạng máy tính) vắng 4 buổi = 16/60 tiết; 906 vắng có phép 2 buổi', () => {
    const mmt = buildMoodleDemoSpec(FIXTURE_CUTOFF).courses.find(
      (c) => c.idnumber === '010100089201',
    );
    const count = (mssv: string, mark: string) =>
      mmt?.attendance.sessions.filter((s) => s.statuses[mssv] === mark).length;
    expect(count('KTPM2411903', 'A')).toBe(4);
    expect(count('KTPM2411906', 'E')).toBe(2);
  });

  it('từ chối ngày chốt ngoài khoảng hợp lệ của học kỳ demo', () => {
    expect(() => buildMoodleDemoSpec('2026-10-01')).toThrow(/ngoài khoảng/);
    expect(() => buildMoodleDemoSpec('2026-12-25')).toThrow(/ngoài khoảng/);
    expect(() => buildMoodleDemoSpec('06/11/2026')).toThrow(/không hợp lệ/);
  });

  it('yesterdayVn tính theo giờ Việt Nam', () => {
    expect(yesterdayVn(new Date('2026-11-07T18:30:00Z'))).toBe('2026-11-07'); // 01:30 ngày 08/11 VN
    expect(yesterdayVn(new Date('2026-11-07T10:00:00Z'))).toBe('2026-11-06');
  });
});
