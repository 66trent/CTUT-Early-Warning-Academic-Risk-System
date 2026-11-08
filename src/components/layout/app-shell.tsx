'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { CalendarDays, Menu } from 'lucide-react';
import { NotificationBell } from '@/components/alerts/notification-bell';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserRole } from '@/db/enums';
import { APP_NAME, UNIVERSITY_NAME } from '@/lib/app-config';
import { cn } from '@/lib/utils';
import { NAV_GROUPS, isNavItemActive } from './nav-config';
import { QuickSearch } from './quick-search';
import { UserMenu } from './user-menu';

export interface AppShellUser {
  fullName: string;
  role: UserRole;
}

interface AppShellProps {
  user: AppShellUser;
  /** Tên học kỳ hiện tại; null khi chưa có (dữ liệu học kỳ có từ Phase 2). */
  currentTermName: string | null;
  children: ReactNode;
}

const ROLE_ROOT: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/admin',
  [UserRole.ADVISOR]: '/advisor',
  [UserRole.STUDENT]: '/student',
};

/** `rail`: màn hình vừa (768–1023px) menu thu thành cột biểu tượng. */
function Brand({ rail = false }: { rail?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-4',
        rail && 'md:max-lg:justify-center md:max-lg:px-2',
      )}
    >
      {/* Logo xanh đậm cần nền trắng để không chìm vào sidebar navy. */}
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white">
        <Image src="/logo.png" alt="" width={40} height={40} className="size-10" priority />
      </span>
      <div className={cn('min-w-0', rail && 'md:max-lg:hidden')}>
        <p className="truncate text-base leading-tight font-bold text-sidebar-accent-foreground">
          {APP_NAME}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-sidebar-muted">{UNIVERSITY_NAME}</p>
      </div>
    </div>
  );
}

function SidebarNav({
  role,
  onNavigate,
  rail = false,
}: {
  role: UserRole;
  onNavigate?: () => void;
  rail?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu chính" className="flex flex-col gap-4 overflow-y-auto px-3 pb-4">
      {NAV_GROUPS[role].map((group, gi) => (
        <div key={group.title ?? gi} className="flex flex-col gap-1">
          {group.title && (
            <p
              className={cn(
                'px-3 pb-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase',
                rail && 'md:max-lg:sr-only',
              )}
            >
              {group.title}
            </p>
          )}
          {rail && gi > 0 && <hr className="mx-2 hidden border-sidebar-border md:max-lg:block" />}
          {group.items.map(({ title, href, icon: Icon }) => {
            const active = isNavItemActive(pathname, href, ROLE_ROOT[role]);
            const link = (
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                  active
                    ? 'bg-sidebar-primary font-semibold text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  rail && 'md:max-lg:justify-center md:max-lg:px-0',
                )}
              >
                <Icon aria-hidden className="size-5 shrink-0" />
                <span className={cn(rail && 'md:max-lg:sr-only')}>{title}</span>
              </Link>
            );
            if (!rail) return <div key={href}>{link}</div>;
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="hidden md:max-lg:block">
                  {title}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ user, currentTermName, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-workspace">
      <aside className="fixed inset-y-0 left-0 hidden w-16 flex-col border-r border-sidebar-border bg-sidebar md:flex lg:w-64">
        <Brand rail />
        <SidebarNav role={user.role} rail />
      </aside>

      <div className="flex min-h-screen flex-col md:pl-16 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
                aria-label="Mở menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">Menu chính</SheetTitle>
              <Brand />
              <SidebarNav role={user.role} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <span className="hidden h-9 items-center gap-2 rounded-md bg-primary-soft px-3 text-sm font-medium text-accent-strong sm:inline-flex">
            <CalendarDays aria-hidden className="size-4 text-primary" />
            {currentTermName ?? 'Chưa đặt học kỳ hiện tại'}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {user.role !== UserRole.STUDENT && <QuickSearch role={user.role} />}
            {user.role !== UserRole.STUDENT && (
              <NotificationBell
                allHref={
                  user.role === UserRole.ADMIN ? '/admin/evaluations' : '/advisor/notifications'
                }
              />
            )}
            <UserMenu fullName={user.fullName} role={user.role} />
          </div>
        </header>

        {/* Một khung chung: mép trái nội dung không nhảy khi đổi trang (docs/rules/03). */}
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
