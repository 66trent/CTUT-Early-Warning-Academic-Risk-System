'use client';

import { GraduationCap, Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { UserRole } from '@/db/enums';
import { quickSearchStudentsAction } from '@/modules/admin/actions/quick-search.action';
import type { QuickSearchStudentDto } from '@/modules/admin/services/student-search.service';
import { navItemsOf } from './nav-config';

const DEBOUNCE_MS = 250;

const fold = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

const PROFILE_BASE: Partial<Record<UserRole, string>> = {
  [UserRole.ADMIN]: '/admin/students',
  [UserRole.ADVISOR]: '/advisor/students',
};

/**
 * Tìm nhanh (Ctrl+K / ⌘K): sinh viên theo MSSV hoặc họ tên (gõ không dấu được) + đi tới trang.
 * Chỉ Admin và Cố vấn học tập; phạm vi sinh viên kiểm ở server.
 */
export function QuickSearch({ role }: { role: UserRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<QuickSearchStudentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileBase = PROFILE_BASE[role];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void quickSearchStudentsAction({ q }).then((r) => {
        if (cancelled) return;
        setLoading(false);
        setStudents(r.ok ? r.data : []);
        setError(r.ok ? null : r.message);
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (!profileBase) return null;

  const tooShort = query.trim().length < 2;
  const folded = fold(query.trim());
  const pages = navItemsOf(role).filter((p) => folded === '' || fold(p.title).includes(folded));
  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    setStudents([]);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 text-muted-foreground max-sm:size-11 max-sm:px-0"
        onClick={() => setOpen(true)}
        aria-label="Tìm nhanh sinh viên hoặc trang (Ctrl+K)"
      >
        <Search aria-hidden />
        <span className="hidden sm:inline">Tìm sinh viên…</span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[11px] md:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Tìm nhanh"
        description="Gõ MSSV hoặc họ tên sinh viên, hoặc tên trang"
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="MSSV hoặc họ tên (gõ không dấu được)…"
        />
        <CommandList>
          {!tooShort && !loading && students.length === 0 && pages.length === 0 && (
            <CommandEmpty>{error ?? 'Không tìm thấy kết quả phù hợp.'}</CommandEmpty>
          )}
          {!tooShort && (students.length > 0 || loading) && (
            <CommandGroup
              heading={role === UserRole.ADVISOR ? 'Sinh viên lớp bạn phụ trách' : 'Sinh viên'}
            >
              {loading && students.length === 0 && (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader2 aria-hidden className="size-4 animate-spin" /> Đang tìm…
                </div>
              )}
              {students.map((s) => (
                <CommandItem
                  key={s.studentId}
                  value={`student-${s.studentId}`}
                  onSelect={() => go(`${profileBase}/${s.studentId}`)}
                >
                  <GraduationCap aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{s.fullName}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {s.studentId} · {s.classId}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {pages.length > 0 && (
            <CommandGroup heading="Đi tới trang">
              {pages.map(({ href, title, icon: Icon }) => (
                <CommandItem key={href} value={`page-${href}`} onSelect={() => go(href)}>
                  <Icon aria-hidden />
                  {title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {tooShort && (
            <p className="px-4 pb-3 text-xs text-muted-foreground">
              Gõ ít nhất 2 ký tự để tìm sinh viên. <CommandShortcut>Esc để đóng</CommandShortcut>
            </p>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
