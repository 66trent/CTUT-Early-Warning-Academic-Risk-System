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

const ALL = 'ALL';

/** Lọc lớp theo khóa, "chưa có CVHT" và tìm kiếm — lưu trên URL, giữ khoa đang chọn. */
export function ClassesFilter({ cohorts }: { cohorts: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const noAdvisor = params.get('noAdvisor') === '1';

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
    <div className="flex flex-wrap items-center gap-3">
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
          placeholder="Mã lớp, tên lớp hoặc tên Cố vấn học tập"
          className="w-full sm:w-72"
          aria-label="Tìm lớp"
        />
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Tìm
        </Button>
      </form>
      <Select value={params.get('cohort') ?? ALL} onValueChange={(v) => update({ cohort: v })}>
        <SelectTrigger className="w-full sm:w-40" aria-label="Lọc theo khóa">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi khóa</SelectItem>
          {cohorts.map((c) => (
            <SelectItem key={c} value={c}>
              Khóa {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={noAdvisor ? 'default' : 'outline'}
        aria-pressed={noAdvisor}
        onClick={() => update({ noAdvisor: noAdvisor ? null : '1' })}
      >
        Chưa có Cố vấn học tập
      </Button>
    </div>
  );
}
