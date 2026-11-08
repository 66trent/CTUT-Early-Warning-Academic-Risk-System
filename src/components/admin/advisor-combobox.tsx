'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { AdvisorOptionDto } from '@/modules/admin/services/class.service';

const fold = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

/**
 * Chọn Cố vấn học tập có tìm kiếm (mã hoặc họ tên, gõ không dấu được) — dùng khi tạo lớp và đổi
 * Cố vấn học tập. `value` rỗng = chưa gán.
 */
export function AdvisorCombobox({
  id,
  value,
  onChange,
  advisors,
}: {
  id?: string;
  value: string;
  onChange: (advisorId: string) => void;
  advisors: AdvisorOptionDto[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = advisors.find((a) => a.userId === value) ?? null;
  const q = fold(query.trim());
  const matches = advisors.filter(
    (a) => q === '' || fold(a.fullName).includes(q) || a.userId.toLowerCase().includes(q),
  );
  const pick = (advisorId: string) => {
    onChange(advisorId);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? `${selected.fullName} (${selected.userId})` : 'Chưa gán'}
          </span>
          <ChevronsUpDown aria-hidden className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Tìm mã hoặc họ tên…" />
          <CommandList>
            <CommandEmpty>Không có Cố vấn học tập phù hợp.</CommandEmpty>
            <CommandGroup>
              {q === '' && (
                <CommandItem value="__none__" onSelect={() => pick('')}>
                  <Check aria-hidden className={cn(value === '' ? 'opacity-100' : 'opacity-0')} />
                  Chưa gán
                </CommandItem>
              )}
              {matches.map((a) => (
                <CommandItem key={a.userId} value={a.userId} onSelect={() => pick(a.userId)}>
                  <Check
                    aria-hidden
                    className={cn(value === a.userId ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{a.fullName}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {a.userId}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
