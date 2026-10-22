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
 * Lọc theo Khoa (suy ra qua lớp sinh hoạt của sinh viên — docs/rules/07). Lưu trên URL
 * `?department=` để trang server đọc; đổi khoa thì bỏ trang/mục đang mở.
 */
export function DepartmentFilter({
  departments,
  value,
}: {
  departments: { departmentId: string; departmentName: string }[];
  value: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(departmentId) => {
        const next = new URLSearchParams(params.toString());
        if (departmentId === ALL) next.delete('department');
        else next.set('department', departmentId);
        // Ngành thuộc khoa — đổi khoa thì bỏ lọc ngành.
        next.delete('major');
        next.delete('page');
        next.delete('alert');
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      <SelectTrigger aria-label="Khoa" className="w-72 max-w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tất cả khoa</SelectItem>
        {departments.map((d) => (
          <SelectItem key={d.departmentId} value={d.departmentId}>
            {d.departmentName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
