import { describe, expect, it } from 'vitest';
import { buildSetupSteps, type SetupCounts } from '@/modules/admin/services/setup-steps';

/** DB vừa chạy `npm run seed`: chỉ có khoa. */
const SEEDED: SetupCounts = {
  departments: 6,
  activeAdvisors: 0,
  pendingAdvisors: 0,
  classes: 0,
  classesWithoutAdvisor: 0,
  students: 0,
  currentTerm: null,
  attendanceRows: 0,
  lmsRows: 0,
  assignmentRows: 0,
  finalResults: 0,
  completedRuns: 0,
  alerts: 0,
  waitingAlerts: 0,
};

const stepOf = (counts: SetupCounts, key: string) => {
  const step = buildSetupSteps(counts).find((s) => s.key === key);
  if (!step) throw new Error(`không có bước ${key}`);
  return step;
};
const nextKey = (counts: SetupCounts) => buildSetupSteps(counts).find((s) => s.next)?.key;

describe('Trang "Bắt đầu" — checklist theo Quy trình vận hành (docs/rules/00, 07)', () => {
  it('đúng thứ tự: khoa → CVHT → lớp → sinh viên → học kỳ → dữ liệu học tập → đánh giá → xử lý → cuối kỳ', () => {
    expect(buildSetupSteps(SEEDED).map((s) => s.key)).toEqual([
      'departments',
      'advisors',
      'classes',
      'students',
      'term',
      'attendance',
      'lms',
      'evaluation',
      'advisor-handling',
      'final-results',
      'close-term',
    ]);
  });

  it('DB chỉ có seed: khoa đã xong, bước tiếp theo là duyệt CVHT; nhập sinh viên bị chặn vì chưa có lớp', () => {
    expect(stepOf(SEEDED, 'departments').done).toBe(true);
    expect(nextKey(SEEDED)).toBe('advisors');
    expect(stepOf(SEEDED, 'students').blockedReason).toMatch(/lớp sinh hoạt/);
    expect(stepOf(SEEDED, 'attendance').blockedReason).toMatch(/sinh viên/);
  });

  it('chỉ đúng 1 bước được đánh dấu "bước tiếp theo"', () => {
    expect(buildSetupSteps(SEEDED).filter((s) => s.next)).toHaveLength(1);
  });

  it('lớp chưa gán đủ CVHT → bước lớp chưa xong, kèm số lớp thiếu', () => {
    const c = { ...SEEDED, activeAdvisors: 2, classes: 2, classesWithoutAdvisor: 1 };
    expect(stepOf(c, 'classes')).toMatchObject({ done: false, next: true });
    expect(stepOf(c, 'classes').status).toMatch(/1 lớp chưa có Cố vấn học tập/);
  });

  it('có sinh viên nhưng chưa đặt học kỳ hiện tại → dữ liệu học tập bị chặn, bước tiếp theo là học kỳ', () => {
    const c = { ...SEEDED, activeAdvisors: 2, classes: 2, students: 13 };
    expect(nextKey(c)).toBe('term');
    expect(stepOf(c, 'lms').blockedReason).toMatch(/học kỳ hiện tại/);
  });

  it('chạy đánh giá chỉ mở khi đã có dữ liệu học tập; xử lý cảnh báo xong khi không còn cảnh báo chờ', () => {
    const base = {
      ...SEEDED,
      activeAdvisors: 2,
      classes: 2,
      students: 13,
      currentTerm: { termId: 'HK1_2026', termName: 'Học kỳ 1', closed: false },
    };
    expect(stepOf(base, 'evaluation').blockedReason).toMatch(/dữ liệu học tập/);
    const evaluated = {
      ...base,
      attendanceRows: 30,
      lmsRows: 40,
      assignmentRows: 12,
      completedRuns: 1,
      alerts: 10,
      waitingAlerts: 3,
    };
    expect(stepOf(evaluated, 'evaluation').done).toBe(true);
    expect(stepOf(evaluated, 'advisor-handling')).toMatchObject({ done: false, next: true });
    expect(stepOf({ ...evaluated, waitingAlerts: 0 }, 'advisor-handling').done).toBe(true);
    expect(stepOf(evaluated, 'close-term').blockedReason).toMatch(/kết quả học phần/);
  });

  it('học kỳ đã chốt → bước chốt xong; không nhập thêm dữ liệu học tập', () => {
    const closed = {
      ...SEEDED,
      activeAdvisors: 2,
      classes: 2,
      students: 13,
      currentTerm: { termId: 'HK2_2025', termName: 'Học kỳ 2', closed: true },
      finalResults: 30,
    };
    expect(stepOf(closed, 'close-term').done).toBe(true);
    expect(stepOf(closed, 'attendance').blockedReason).toMatch(/đã chốt/);
  });
});
