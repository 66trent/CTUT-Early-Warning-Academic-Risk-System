'use client';

import { ChevronDown, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useSignOut } from '@/components/auth/sign-out-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserRole } from '@/db/enums';
import { ROLE_LABELS } from '@/lib/labels';

/** Chữ cái đầu của tên (từ cuối của họ tên Việt Nam). */
function initialOf(fullName: string): string {
  return (fullName.trim().split(/\s+/).at(-1) ?? '').charAt(0).toUpperCase();
}

/** Tài khoản ở thanh trên: tên + vai trò; đổi giao diện, chính sách dữ liệu, đăng xuất gom vào menu. */
export function UserMenu({ fullName, role }: { fullName: string; role: UserRole }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { signOut, pending } = useSignOut();
  const isDark = resolvedTheme === 'dark';
  const roleLabel = ROLE_LABELS[role];
  // Tên mẫu trùng vai trò ("Quản trị viên / Quản trị viên") thì không lặp dòng thứ hai.
  const showRole = !fullName.startsWith(roleLabel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2 px-2" aria-label="Menu tài khoản">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
              {initialOf(fullName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-semibold">{fullName}</span>
            {showRole && (
              <span className="block text-xs font-normal text-muted-foreground">{roleLabel}</span>
            )}
          </span>
          <ChevronDown aria-hidden className="hidden size-4 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-semibold">{fullName}</span>
          <span className="block text-xs text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(isDark ? 'light' : 'dark')}>
          {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
          {isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/legal/privacy-policy">
            <ShieldCheck aria-hidden />
            Chính sách bảo vệ dữ liệu
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => void signOut()}>
          <LogOut aria-hidden />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
