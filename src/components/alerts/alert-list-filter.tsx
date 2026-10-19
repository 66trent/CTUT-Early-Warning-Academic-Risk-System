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
import { SEVERITY_ORDER } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';
import { SOURCE_LABELS, type SignalSource } from '@/modules/alerts/services/alert-presentation';

const ALL = 'ALL';
const SOURCES: SignalSource[] = ['ATTENDANCE', 'LMS', 'ACADEMIC', 'COMBINED'];
const STATUS_OPTIONS = [
  { value: 'waiting', label: 'Chờ xác nhận' },
  { value: 'following', label: 'Đang theo dõi' },
  { value: 'done', label: 'Đã xong hoặc bỏ qua' },
  { value: 'overdue', label: 'Quá hạn chưa xác nhận' },
];

/**
 * Bộ lọc danh sách cảnh báo (lưu trên URL, về trang 1 khi đổi): tìm MSSV / họ tên, lớp, mức,
 * nguồn dấu hiệu, nhóm trạng thái. `classes` rỗng → ẩn ô lớp.
 */
export function AlertListFilter({ classes }: { classes: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === ALL) next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    next.delete('alert');
    router.push(`${pathname}?${next.toString()}`);
  };

  const select = (
    key: string,
    label: string,
    allLabel: string,
    options: { value: string; label: string }[],
    width = 'sm:w-44',
  ) => (
    <Select value={params.get(key) ?? ALL} onValueChange={(v) => update({ [key]: v })}>
      <SelectTrigger size="sm" className={`w-full ${width}`} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
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
          placeholder="MSSV hoặc họ tên"
          className="h-8 w-full sm:w-56"
          aria-label="Tìm sinh viên trong danh sách cảnh báo"
        />
        <Button type="submit" size="sm" variant="outline">
          <Search aria-hidden />
          Tìm
        </Button>
      </form>
      {classes.length > 1 &&
        select(
          'classId',
          'Lọc theo lớp',
          'Mọi lớp',
          classes.map((c) => ({ value: c, label: c })),
          'sm:w-36',
        )}
      {select(
        'severity',
        'Lọc theo mức',
        'Mọi mức',
        [...SEVERITY_ORDER].reverse().map((s) => ({ value: s, label: SEVERITY_LABELS[s] })),
        'sm:w-36',
      )}
      {select(
        'source',
        'Lọc theo nguồn dấu hiệu',
        'Mọi nguồn',
        SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] })),
        'sm:w-56',
      )}
      {select('status', 'Lọc theo trạng thái', 'Mọi trạng thái', STATUS_OPTIONS)}
    </div>
  );
}
