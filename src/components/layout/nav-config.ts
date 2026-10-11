import {
  Activity,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardCheck,
  FileUp,
  GraduationCap,
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

/** Menu theo vai trò. Trang chưa làm sẽ được thêm dần theo phase. */
export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  [UserRole.ADMIN]: [
    { title: 'Bắt đầu', href: '/admin/getting-started', icon: ClipboardCheck },
    { title: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
    { title: 'Tài khoản', href: '/admin/users', icon: Users },
    { title: 'Học kỳ', href: '/admin/terms', icon: CalendarRange },
    { title: 'Khoa và lớp sinh hoạt', href: '/admin/classes', icon: Building2 },
    { title: 'Nhập dữ liệu', href: '/admin/imports', icon: FileUp },
    { title: 'Cấu hình luật', href: '/admin/rules', icon: SlidersHorizontal },
    { title: 'Chạy đánh giá', href: '/admin/evaluations', icon: Activity },
    { title: 'Cảnh báo sớm', href: '/admin/alerts', icon: ShieldAlert },
    { title: 'Nhật ký hệ thống', href: '/admin/audit-logs', icon: ScrollText },
  ],
  [UserRole.ADVISOR]: [
    { title: 'Cảnh báo cần xử lý', href: '/advisor', icon: ShieldAlert },
    { title: 'Sinh viên phụ trách', href: '/advisor/students', icon: GraduationCap },
  ],
  [UserRole.STUDENT]: [
    { title: 'Tình hình học tập', href: '/student', icon: BookOpen },
    { title: 'Liên hệ Cố vấn học tập', href: '/student/advisor', icon: MessageCircle },
  ],
};

/** Mục đang chọn: khớp chính xác, hoặc là trang con (trừ mục gốc của vai trò như `/admin`). */
export function isNavItemActive(pathname: string, href: string, roleRoot: string): boolean {
  if (pathname === href) return true;
  return href !== roleRoot && pathname.startsWith(`${href}/`);
}
