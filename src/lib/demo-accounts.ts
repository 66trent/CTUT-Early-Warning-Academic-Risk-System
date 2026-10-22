/**
 * Bộ demo toàn Khoa CNTT khóa 2024 (Phase 9, người dùng chốt 2026-10-22 — docs/implement.md):
 * 5 lớp, mỗi lớp 1 Cố vấn học tập + 1 sinh viên tiêu biểu (`<lớp>903`) đăng nhập nhanh.
 * File không import thư viện server — dùng chung cho seed, Better Auth và màn đăng nhập.
 */
export const DEMO_CLASS_ACCOUNTS = [
  { classId: 'CNTT2411', majorId: 'CNTT', majorName: 'Công nghệ thông tin', advisorId: 'GV002' },
  { classId: 'KTPM2411', majorId: 'KTPM', majorName: 'Kỹ thuật phần mềm', advisorId: 'GV001' },
  { classId: 'HTTT2411', majorId: 'HTTT', majorName: 'Hệ thống thông tin', advisorId: 'GV003' },
  { classId: 'KHMT2411', majorId: 'KHMT', majorName: 'Khoa học máy tính', advisorId: 'GV004' },
  { classId: 'KHDL2411', majorId: 'KHDL', majorName: 'Khoa học dữ liệu', advisorId: 'GV005' },
] as const;

/** Mã sinh viên tiêu biểu của 1 lớp demo. */
export const demoStudentOf = (classId: string) => `${classId}903`;

/** Cố vấn học tập demo GV001–GV005 (theo thứ tự mã). */
export const DEMO_ADVISOR_IDS = ['GV001', 'GV002', 'GV003', 'GV004', 'GV005'] as const;

/** Sinh viên demo đăng nhập không cần Google — chỉ khi đã có hồ sơ (docs/rules/06). */
export const DEMO_STUDENT_ACCOUNTS = [
  'CNTT2411903',
  'KTPM2411903',
  'HTTT2411903',
  'KHMT2411903',
  'KHDL2411903',
] as const;

export const DEMO_ACCOUNTS = ['ADMIN', ...DEMO_ADVISOR_IDS, ...DEMO_STUDENT_ACCOUNTS] as const;
export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];
