'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL = 'ALL';

/**
 * Lọc theo Ngành của lớp sinh hoạt (docs/rules/09, Phase 9a). Lưu trên URL `?major=`; danh sách đã
 * lọc theo khoa đang chọn. Không có ngành nào thì ẩn.
 */
export function MajorFilter({
  majors,
  value,
}: {
  majors: { majorId: string; majorName: string }[];
  value: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (majors.length === 0) return null;
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(majorId) => {
        const next = new URLSearchParams(params.toString());
        if (majorId === ALL) next.delete('major');
        else next.set('major', majorId);
        next.delete('page');
        next.delete('alert');
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      <SelectTrigger aria-label="Ngành" className="w-60 max-w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tất cả ngành</SelectItem>
        {majors.map((m) => (
          <SelectItem key={m.majorId} value={m.majorId}>
            {m.majorName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
