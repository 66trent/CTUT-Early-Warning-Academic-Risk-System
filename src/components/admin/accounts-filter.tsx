'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { ACCOUNT_STATUS_LABELS } from '@/lib/labels';

const ALL = 'ALL';
const ROLE_OPTIONS = [
  { value: 'STAFF', label: 'Cán bộ (Cố vấn học tập và Quản trị viên)' },
  { value: UserRole.ADVISOR, label: 'Cố vấn học tập' },
  { value: UserRole.ADMIN, label: 'Quản trị viên' },
  { value: UserRole.STUDENT, label: 'Sinh viên' },
];

/** Bộ lọc lưu trên URL (?role=&status=&q=) để trang server đọc và phân trang. */
export function AccountsFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const noClass = params.get('noClass') === '1';
  const role = params.get('role') ?? 'STAFF';

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === ALL) next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        value={params.get('role') ?? 'STAFF'}
        onValueChange={(v) => update({ role: v, noClass: null })}
      >
        <SelectTrigger className="w-full sm:w-72" aria-label="Lọc theo vai trò">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get('status') ?? ALL} onValueChange={(v) => update({ status: v })}>
        <SelectTrigger className="w-full sm:w-48" aria-label="Lọc theo trạng thái">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
          {Object.values(UserAccountStatus).map((s) => (
            <SelectItem key={s} value={s}>
              {ACCOUNT_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <form
        className="flex w-full gap-2 sm:w-auto"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() });
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm mã, họ tên, email"
          className="w-full sm:w-64"
          aria-label="Tìm tài khoản"
        />
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Tìm
        </Button>
      </form>
      {(role === 'STAFF' || role === 'ADVISOR') && (
        <Button
          variant={noClass ? 'default' : 'outline'}
          aria-pressed={noClass}
          onClick={() => update({ noClass: noClass ? null : '1' })}
        >
          Cố vấn học tập chưa gán lớp
        </Button>
      )}
    </div>
  );
}
