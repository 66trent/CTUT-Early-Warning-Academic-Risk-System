import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  Grid3x3,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { UserRole } from '@/db/enums';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** null = nhóm không tiêu đề (vai trò ít mục). */
  title: string | null;
  items: NavItem[];
}

/** Menu theo vai trò, gom nhóm theo trình tự công việc (docs/rules/07). */
export const NAV_GROUPS: Record<UserRole, NavGroup[]> = {
  [UserRole.ADMIN]: [
    {
      title: 'Bắt đầu',
      items: [
        { title: 'Bắt đầu', href: '/admin/getting-started', icon: ClipboardCheck },
        { title: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Dữ liệu nền',
      items: [
        { title: 'Tài khoản', href: '/admin/users', icon: Users },
        { title: 'Học kỳ', href: '/admin/terms', icon: CalendarRange },
        { title: 'Khoa và lớp sinh hoạt', href: '/admin/classes', icon: Building2 },
        { title: 'Sinh viên', href: '/admin/students', icon: GraduationCap },
      ],
    },
    {
      title: 'Hằng tuần',
      items: [
        { title: 'Nhập dữ liệu', href: '/admin/imports', icon: FileUp },
        { title: 'Chạy đánh giá', href: '/admin/evaluations', icon: Activity },
        { title: 'Cảnh báo sớm', href: '/admin/alerts', icon: ShieldAlert },
      ],
    },
    {
      title: 'Cấu hình và giám sát',
      items: [
        { title: 'Cấu hình luật', href: '/admin/rules', icon: SlidersHorizontal },
        { title: 'Nhật ký hệ thống', href: '/admin/audit-logs', icon: ScrollText },
      ],
    },
  ],
  [UserRole.ADVISOR]: [
    {
      title: null,
      items: [
        { title: 'Tổng quan', href: '/advisor', icon: LayoutDashboard },
        { title: 'Cảnh báo cần xử lý', href: '/advisor/alerts', icon: ShieldAlert },
        { title: 'Sinh viên phụ trách', href: '/advisor/students', icon: GraduationCap },
        { title: 'Ma trận lớp', href: '/advisor/matrix', icon: Grid3x3 },
        { title: 'Thông báo', href: '/advisor/notifications', icon: Bell },
      ],
    },
  ],
  [UserRole.STUDENT]: [
    {
      title: null,
      items: [
        { title: 'Tình hình học tập', href: '/student', icon: BookOpen },
        { title: 'Liên hệ Cố vấn học tập', href: '/student/advisor', icon: MessageCircle },
      ],
    },
  ],
};

/** Danh sách phẳng — cho tìm nhanh (Ctrl+K). */
export const navItemsOf = (role: UserRole): NavItem[] => NAV_GROUPS[role].flatMap((g) => g.items);

/** Mục đang chọn: khớp chính xác, hoặc là trang con (trừ mục gốc của vai trò như `/admin`). */
export function isNavItemActive(pathname: string, href: string, roleRoot: string): boolean {
  if (pathname === href) return true;
  return href !== roleRoot && pathname.startsWith(`${href}/`);
}
