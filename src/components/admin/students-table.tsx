'use client';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { OFFICIAL_STATUS_LABELS } from '@/lib/labels';
import type { SortDir } from '@/lib/list-params';
import type { StudentSearchItemDto } from '@/modules/admin/services/student-search.service';

const columns: ColumnDef<StudentSearchItemDto>[] = [
  {
    accessorKey: 'fullName',
    header: 'Sinh viên',
    meta: { sortKey: 'fullName', mobile: 'title' },
    cell: ({ row }) => (
      <>
        <Link
          href={`/admin/students/${row.original.studentId}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.fullName}
        </Link>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {row.original.studentId}
        </span>
      </>
    ),
  },
  {
    accessorKey: 'classId',
    header: 'Lớp',
    meta: { sortKey: 'classId' },
    cell: ({ row }) => <span className="tabular-nums">{row.original.classId}</span>,
  },
  {
    accessorKey: 'officialAcademicStatus',
    header: 'Tình trạng học vụ (từ phòng đào tạo)',
    meta: { label: 'Học vụ' },
    cell: ({ row }) => OFFICIAL_STATUS_LABELS[row.original.officialAcademicStatus],
  },
];

export function StudentsTable({
  items,
  sort,
  emptyMessage,
}: {
  items: StudentSearchItemDto[];
  sort: { sort: string | null; dir: SortDir };
  emptyMessage: React.ReactNode;
}) {
  return (
    <DataTable
      columns={columns}
      data={items}
      getRowId={(s) => s.studentId}
      serverSort={sort}
      emptyMessage={emptyMessage}
    />
  );
}
