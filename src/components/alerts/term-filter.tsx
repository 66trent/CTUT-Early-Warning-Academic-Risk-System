'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TermOptionDto } from '@/modules/alerts/services/alert-terms';

/** Lọc theo học kỳ — mặc định học kỳ hiện tại, cho đổi sang học kỳ khác (docs/rules/07). */
export function TermFilter({ terms, value }: { terms: TermOptionDto[]; value: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <Select
      value={value}
      onValueChange={(termId) => {
        const next = new URLSearchParams(params.toString());
        next.set('term', termId);
        next.delete('alert');
        router.push(`?${next.toString()}`);
      }}
    >
      <SelectTrigger aria-label="Học kỳ" className="w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {terms.map((t) => (
          <SelectItem key={t.termId} value={t.termId}>
            {t.termName}
            {t.isCurrent ? ' (hiện tại)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
