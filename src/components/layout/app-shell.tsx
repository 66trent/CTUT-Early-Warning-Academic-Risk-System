'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { CalendarDays, Menu } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { UserRole } from '@/db/enums';
import { APP_NAME, UNIVERSITY_NAME } from '@/lib/app-config';
import { ROLE_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isNavItemActive } from './nav-config';

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

function Brand() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <Image src="/logo.png" alt="" width={40} height={40} className="size-10 shrink-0" priority />
      <div className="min-w-0">
        <p className="truncate text-base leading-tight font-bold text-accent-strong">{APP_NAME}</p>
        <p className="truncate text-xs leading-tight text-muted-foreground">{UNIVERSITY_NAME}</p>
      </div>
    </div>
  );
}

function SidebarNav({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu chính" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS[role].map(({ title, href, icon: Icon }) => {
        const active = isNavItemActive(pathname, href, ROLE_ROOT[role]);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150',
              active ? 'bg-primary-soft text-primary' : 'text-foreground hover:bg-secondary',
            )}
          >
            <Icon aria-hidden className="size-5 shrink-0" />
            {title}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ user, currentTermName, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-workspace">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Brand />
        <SidebarNav role={user.role} />
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 lg:hidden"
                aria-label="Mở menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu chính</SheetTitle>
              <Brand />
              <SidebarNav role={user.role} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex">
            <CalendarDays aria-hidden />
            {currentTermName ?? 'Chưa đặt học kỳ hiện tại'}
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{user.fullName}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
            </div>
            <SignOutButton compact />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
