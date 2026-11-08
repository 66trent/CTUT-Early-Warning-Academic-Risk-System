/**
 * Bộ demo Khoa CNTT (bản v4, docs/demo-data/KET_QUA_MONG_DOI.md): 6 lớp, mỗi lớp 1 Cố vấn học tập
 * + 1 sinh viên tiêu biểu (`<lớp>903`) đăng nhập nhanh. Họ tên cố vấn là giả.
 * File không import thư viện server — dùng chung cho seed, Better Auth và màn đăng nhập.
 */
export const DEMO_CLASS_ACCOUNTS = [
  {
    classId: 'CNTT2411',
    majorId: 'CNTT',
    majorName: 'Công nghệ thông tin',
    advisorId: 'GV002',
    cohortYear: '2024',
  },
  {
    classId: 'KTPM2411',
    majorId: 'KTPM',
    majorName: 'Kỹ thuật phần mềm',
    advisorId: 'GV001',
    cohortYear: '2024',
  },
  {
    classId: 'HTTT2411',
    majorId: 'HTTT',
    majorName: 'Hệ thống thông tin',
    advisorId: 'GV003',
    cohortYear: '2024',
  },
  {
    classId: 'KHMT2411',
    majorId: 'KHMT',
    majorName: 'Khoa học máy tính',
    advisorId: 'GV004',
    cohortYear: '2024',
  },
  {
    classId: 'KHDL2411',
    majorId: 'KHDL',
    majorName: 'Khoa học dữ liệu',
    advisorId: 'GV005',
    cohortYear: '2024',
  },
  {
    classId: 'KTPM2511',
    majorId: 'KTPM',
    majorName: 'Kỹ thuật phần mềm',
    advisorId: 'GV006',
    cohortYear: '2025',
  },
] as const;

/** Mã sinh viên tiêu biểu của 1 lớp demo. */
export const demoStudentOf = (classId: string) => `${classId}903`;

/** Cố vấn học tập demo GV001–GV006 (theo thứ tự mã). */
export const DEMO_ADVISOR_IDS = ['GV001', 'GV002', 'GV003', 'GV004', 'GV005', 'GV006'] as const;

/** Họ tên (giả) của Cố vấn học tập demo. */
export const DEMO_ADVISOR_NAMES: Record<(typeof DEMO_ADVISOR_IDS)[number], string> = {
  GV001: 'Nguyễn Hoàng Anh',
  GV002: 'Trần Thị Mỹ Duyên',
  GV003: 'Lê Quốc Bảo',
  GV004: 'Phạm Ngọc Hân',
  GV005: 'Võ Minh Trí',
  GV006: 'Đỗ Thanh Tâm',
};

/** Cố vấn học tập ở trạng thái chờ duyệt, để trình diễn màn hình duyệt tài khoản. */
export const DEMO_PENDING_ADVISOR = { userId: 'GV007', fullName: 'Bùi Anh Khoa' } as const;

/** Sinh viên demo đăng nhập không cần Google — chỉ khi đã có hồ sơ (docs/rules/06). */
export const DEMO_STUDENT_ACCOUNTS = [
  'CNTT2411903',
  'KTPM2411903',
  'HTTT2411903',
  'KHMT2411903',
  'KHDL2411903',
  'KTPM2511903',
] as const;

export const DEMO_ACCOUNTS = ['ADMIN', ...DEMO_ADVISOR_IDS, ...DEMO_STUDENT_ACCOUNTS] as const;
export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];
