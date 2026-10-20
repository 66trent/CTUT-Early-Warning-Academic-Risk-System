'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { formatVnDate } from '@/lib/dates';
import type {
  CourseFreshnessDto,
  CourseSourceFreshnessDto,
  FreshnessSource,
} from '@/modules/admin/services/overview.service';

const shortDate = (iso: string) => formatVnDate(iso).slice(0, 5);

/** 1 ô: ngày mới nhất; "Chậm" (vàng); "Chưa có" — điểm danh vàng, LMS / kết quả trung tính. */
function FreshnessCell({
  source,
  cell,
}: {
  source: FreshnessSource;
  cell: CourseSourceFreshnessDto;
}) {
  if (cell.latest === null) {
    const warn = source === 'ATTENDANCE';
    const hint =
      source === 'COURSE_RESULT'
        ? 'Chưa khóa điểm'
        : source === 'ATTENDANCE'
          ? 'Chưa có'
          : 'Chưa có (có thể không dùng LMS)';
    return (
      <span
        className={
          warn
            ? 'text-xs font-medium text-amber-700 dark:text-amber-400'
            : 'text-xs text-muted-foreground'
        }
      >
        {hint}
      </span>
    );
  }
  if (cell.stale) {
    return (
      <span className="w-fit rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Chậm · {shortDate(cell.latest)}
      </span>
    );
  }
  return <span className="tabular-nums">{formatVnDate(cell.latest)}</span>;
}

const SOURCES: { source: FreshnessSource; header: string }[] = [
  { source: 'ATTENDANCE', header: 'Điểm danh' },
  { source: 'LMS_QUIZ', header: 'Trắc nghiệm' },
  { source: 'LMS_ASSIGNMENT', header: 'Thực hành' },
  { source: 'COURSE_RESULT', header: 'Kết quả' },
];

const columns: ColumnDef<CourseFreshnessDto>[] = [
  {
    accessorKey: 'courseName',
    header: 'Học phần',
    meta: { mobile: 'title' },
    cell: ({ row }) => (
      <span className="inline-flex flex-col">
        <span className="font-medium">{row.original.courseName}</span>
        <span className="text-xs text-muted-foreground">{row.original.courseId}</span>
      </span>
    ),
  },
  ...SOURCES.map(({ source, header }): ColumnDef<CourseFreshnessDto> => ({
    id: source,
    header,
    enableSorting: false,
    cell: ({ row }) => <FreshnessCell source={source} cell={row.original.sources[source]} />,
  })),
];

/**
 * Độ mới dữ liệu theo học phần ở trang Nhập dữ liệu (Phase 8f, cùng truy vấn tổng quan 8d): mặc
 * định chỉ hiện học phần cần nhắc nạp.
 */
export function CourseFreshnessTable({ courses }: { courses: CourseFreshnessDto[] }) {
  const attention = courses.filter((c) => c.needsAttention);
  const [onlyAttention, setOnlyAttention] = useState(attention.length > 0);
  const rows = onlyAttention ? attention : courses;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant={onlyAttention ? 'default' : 'outline'}
          aria-pressed={onlyAttention}
          onClick={() => setOnlyAttention(true)}
        >
          Cần nạp ({attention.length})
        </Button>
        <Button
          size="sm"
          variant={onlyAttention ? 'outline' : 'default'}
          aria-pressed={!onlyAttention}
          onClick={() => setOnlyAttention(false)}
        >
          Tất cả học phần ({courses.length})
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(c) => c.courseId}
        emptyMessage={
          onlyAttention
            ? 'Mọi học phần đều đã có dữ liệu điểm danh và LMS đều đặn.'
            : 'Học kỳ chưa có học phần nào — học phần tự tạo khi nạp dữ liệu học tập đầu tiên.'
        }
      />
    </div>
  );
}
