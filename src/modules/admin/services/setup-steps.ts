/**
 * Checklist trang "Bắt đầu" theo đúng "Quy trình vận hành" ở docs/rules/00 (docs/rules/07):
 * tự đánh dấu bước đã có dữ liệu, chặn/gợi ý bước kế tiếp. Hàm thuần — test không cần DB.
 */

export interface SetupCounts {
  departments: number;
  activeAdvisors: number;
  pendingAdvisors: number;
  classes: number;
  classesWithoutAdvisor: number;
  students: number;
  currentTerm: { termId: string; termName: string; closed: boolean } | null;
  /** Luật cảnh báo đang có phiên bản áp dụng (không tính cấu hình RiskScore). */
  activeRules: number;
  /** Các số dưới đây tính trong học kỳ hiện tại. */
  attendanceRows: number;
  lmsRows: number;
  assignmentRows: number;
  /** Kết quả học phần đã khóa điểm. */
  finalResults: number;
  completedRuns: number;
  alerts: number;
  /** Cảnh báo `OPEN`/`REOPENED` chờ Cố vấn học tập xác nhận. */
  waitingAlerts: number;
}

export type SetupPhase = 'FOUNDATION' | 'TERM' | 'DURING_TERM' | 'END_OF_TERM';

export interface SetupStep {
  key: string;
  phase: SetupPhase;
  title: string;
  description: string;
  done: boolean;
  /** Tình trạng hiện tại bằng lời (VD "2 lớp chưa có Cố vấn học tập"). */
  status: string;
  href: string;
  actionLabel: string;
  /** Lý do chưa làm được (thiếu bước trước) — nút bị vô hiệu kèm lý do. */
  blockedReason: string | null;
  /** Bước nên làm tiếp theo (bước đầu tiên chưa xong và không bị chặn). */
  next: boolean;
}

export const SETUP_PHASE_LABELS: Record<SetupPhase, string> = {
  FOUNDATION: 'Thiết lập ban đầu (đầu khóa)',
  TERM: 'Mỗi học kỳ',
  DURING_TERM: 'Hằng tuần',
  END_OF_TERM: 'Cuối kỳ',
};

type StepDraft = Omit<SetupStep, 'next'>;

function foundationSteps(c: SetupCounts): StepDraft[] {
  return [
    {
      key: 'departments',
      phase: 'FOUNDATION',
      title: 'Danh mục khoa',
      description: 'Danh mục khoa chính thức của trường, có sẵn khi cài đặt hệ thống.',
      done: c.departments > 0,
      status:
        c.departments > 0
          ? `${c.departments} khoa`
          : 'Chưa có khoa — báo người cài đặt hệ thống nạp danh mục khoa',
      href: '/admin/classes',
      actionLabel: 'Xem khoa',
      blockedReason: null,
    },
    {
      key: 'advisors',
      phase: 'FOUNDATION',
      title: 'Duyệt tài khoản Cố vấn học tập',
      description: 'Cố vấn học tập tự đăng ký ở trang đăng nhập, Admin duyệt.',
      done: c.activeAdvisors > 0,
      status:
        `${c.activeAdvisors} đang hoạt động` +
        (c.pendingAdvisors > 0 ? ` · ${c.pendingAdvisors} chờ duyệt` : ''),
      href: '/admin/users?role=ADVISOR&status=PENDING_APPROVAL',
      actionLabel: 'Duyệt tài khoản',
      blockedReason: null,
    },
    {
      key: 'classes',
      phase: 'FOUNDATION',
      title: 'Tạo lớp sinh hoạt và gán Cố vấn học tập',
      description: 'Cố vấn học tập chỉ thấy sinh viên của lớp mình được gán.',
      done: c.classes > 0 && c.classesWithoutAdvisor === 0,
      status:
        c.classes === 0
          ? 'Chưa có lớp'
          : `${c.classes} lớp` +
            (c.classesWithoutAdvisor > 0
              ? ` · ${c.classesWithoutAdvisor} lớp chưa có Cố vấn học tập`
              : ''),
      href: '/admin/classes',
      actionLabel: 'Quản lý lớp',
      blockedReason: c.departments === 0 ? 'Chưa có khoa.' : null,
    },
    {
      key: 'students',
      phase: 'FOUNDATION',
      title: 'Nhập danh sách sinh viên',
      description: 'File danh sách sinh viên (CSV hoặc Excel) theo mẫu.',
      done: c.students > 0,
      status: c.students > 0 ? `${c.students} sinh viên` : 'Chưa có sinh viên',
      href: '/admin/imports',
      actionLabel: 'Nhập dữ liệu',
      blockedReason: c.classes === 0 ? 'Chưa có lớp sinh hoạt — tạo lớp trước.' : null,
    },
  ];
}

/** Lý do chưa nhập được dữ liệu học tập của học kỳ hiện tại. */
function academicBlock(c: SetupCounts): string | null {
  if (c.students === 0) return 'Chưa có sinh viên — nhập danh sách sinh viên trước.';
  if (!c.currentTerm) return 'Chưa đặt học kỳ hiện tại.';
  if (c.currentTerm.closed) return 'Học kỳ hiện tại đã chốt.';
  return null;
}

function termSteps(c: SetupCounts): StepDraft[] {
  const block = academicBlock(c);
  const hasAcademic = c.attendanceRows + c.lmsRows + c.assignmentRows + c.finalResults > 0;
  return [
    {
      key: 'term',
      phase: 'TERM',
      title: 'Tạo học kỳ và đặt học kỳ hiện tại',
      description: 'Không cần nhập lớp học phần hay đăng ký học phần — hệ thống tự tạo từ dữ liệu.',
      done: c.currentTerm !== null,
      status: c.currentTerm ? `Hiện tại: ${c.currentTerm.termName}` : 'Chưa đặt học kỳ hiện tại',
      href: '/admin/terms',
      actionLabel: 'Quản lý học kỳ',
      blockedReason: null,
    },
    {
      key: 'rules',
      phase: 'TERM',
      title: 'Xem lại luật cảnh báo',
      description:
        'Luật có sẵn ngưỡng mặc định; chỉnh nếu nhà trường muốn báo sớm hơn hoặc muộn hơn.',
      done: c.activeRules > 0,
      status:
        c.activeRules > 0 ? `${c.activeRules} luật đang áp dụng` : 'Chưa có luật nào đang áp dụng',
      href: '/admin/rules',
      actionLabel: 'Cấu hình luật',
      blockedReason: null,
    },
    {
      key: 'attendance',
      phase: 'DURING_TERM',
      title: 'Nhập điểm danh',
      description: 'Hằng tuần, mỗi lần 1 ngày chốt số liệu (số tiết vắng).',
      done: c.attendanceRows > 0,
      status: c.attendanceRows > 0 ? `${c.attendanceRows} dòng điểm danh` : 'Chưa có',
      href: '/admin/imports',
      actionLabel: 'Nhập dữ liệu',
      blockedReason: block,
    },
    {
      key: 'lms',
      phase: 'DURING_TERM',
      title: 'Nhập bài LMS (trắc nghiệm, thực hành)',
      description: 'Hằng tuần, xuất từ LMS kèm hạn nộp của từng bài.',
      done: c.lmsRows + c.assignmentRows > 0,
      status:
        c.lmsRows + c.assignmentRows > 0
          ? `${c.lmsRows} lượt làm trắc nghiệm · ${c.assignmentRows} bài thực hành`
          : 'Chưa có',
      href: '/admin/imports',
      actionLabel: 'Nhập dữ liệu',
      blockedReason: block,
    },
    {
      key: 'evaluation',
      phase: 'DURING_TERM',
      title: 'Chạy đánh giá',
      description: 'Tự chạy sau mỗi lần nạp và mỗi đêm (chế độ demo: Admin bấm chạy với mốc demo).',
      done: c.completedRuns > 0,
      status: c.completedRuns > 0 ? `${c.completedRuns} lần chạy xong` : 'Chưa chạy',
      href: '/admin/evaluations',
      actionLabel: 'Chạy đánh giá',
      blockedReason: block ?? (hasAcademic ? null : 'Chưa có dữ liệu học tập trong học kỳ.'),
    },
    {
      key: 'advisor-handling',
      phase: 'DURING_TERM',
      title: 'Cố vấn học tập xử lý cảnh báo',
      description:
        'Cố vấn học tập xác nhận, ghi can thiệp; sinh viên chỉ thấy sau khi được xác nhận.',
      done: c.alerts > 0 && c.waitingAlerts === 0,
      status:
        c.alerts === 0
          ? 'Chưa có cảnh báo'
          : `${c.alerts} cảnh báo · ${c.waitingAlerts} chờ Cố vấn học tập xác nhận`,
      href: '/admin/alerts',
      actionLabel: 'Xem cảnh báo',
      blockedReason: c.completedRuns === 0 ? 'Chưa chạy đánh giá.' : null,
    },
  ];
}

function endOfTermSteps(c: SetupCounts): StepDraft[] {
  return [
    {
      key: 'final-results',
      phase: 'END_OF_TERM',
      title: 'Nhập kết quả học phần (khi khóa điểm)',
      description:
        'Học phần nào khóa điểm thì nhập ngay — dùng cho luật không đạt học phần, tín chỉ không đạt, điểm trung bình và nhận diện học lại.',
      done: c.finalResults > 0,
      status: c.finalResults > 0 ? `${c.finalResults} kết quả học phần` : 'Chưa có',
      href: '/admin/imports',
      actionLabel: 'Nhập dữ liệu',
      blockedReason: academicBlock(c),
    },
    {
      key: 'close-term',
      phase: 'END_OF_TERM',
      title: 'Chốt học kỳ',
      description:
        'Hệ thống chạy đánh giá lần cuối (tín chỉ không đạt, điểm trung bình) rồi chốt; sau đó không nhận thêm dữ liệu.',
      done: c.currentTerm?.closed ?? false,
      status: c.currentTerm?.closed ? 'Đã chốt' : 'Chưa chốt',
      href: '/admin/terms',
      actionLabel: 'Quản lý học kỳ',
      blockedReason:
        !c.currentTerm || c.currentTerm.closed
          ? null
          : c.finalResults === 0
            ? 'Chưa có kết quả học phần.'
            : null,
    },
  ];
}

export function buildSetupSteps(c: SetupCounts): SetupStep[] {
  const steps = [...foundationSteps(c), ...termSteps(c), ...endOfTermSteps(c)];
  const nextIndex = steps.findIndex((s) => !s.done && s.blockedReason === null);
  return steps.map((s, i) => ({ ...s, next: i === nextIndex }));
}
