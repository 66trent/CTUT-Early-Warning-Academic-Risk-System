'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL = 'ALL';

/** Lọc lịch sử nạp theo loại / học phần / khoa (docs/rules/12) — lưu trên URL. */
export function BatchesFilter({
  types,
  courses,
  departments,
}: {
  types: { dataType: string; label: string }[];
  courses: { courseId: string; courseName: string }[];
  departments: { departmentId: string; departmentName: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = ['type', 'course', 'department'].some((k) => params.get(k));

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === ALL) next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={params.get('type') ?? ALL} onValueChange={(v) => update({ type: v })}>
        <SelectTrigger size="sm" className="w-full sm:w-52" aria-label="Lọc theo loại dữ liệu">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi loại dữ liệu</SelectItem>
          {types.map((t) => (
            <SelectItem key={t.dataType} value={t.dataType}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {courses.length > 0 && (
        <Select value={params.get('course') ?? ALL} onValueChange={(v) => update({ course: v })}>
          <SelectTrigger size="sm" className="w-full sm:w-64" aria-label="Lọc theo học phần">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi học phần</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.courseId} value={c.courseId}>
                {c.courseName} · {c.courseId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {departments.length > 1 && (
        <Select
          value={params.get('department') ?? ALL}
          onValueChange={(v) => update({ department: v })}
        >
          <SelectTrigger size="sm" className="w-full sm:w-64" aria-label="Lọc theo khoa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi khoa</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.departmentId} value={d.departmentId}>
                {d.departmentName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {active && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => update({ type: null, course: null, department: null })}
        >
          Bỏ lọc
        </Button>
      )}
    </div>
  );
}
