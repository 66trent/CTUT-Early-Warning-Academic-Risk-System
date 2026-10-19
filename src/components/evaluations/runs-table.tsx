'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Activity } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/empty-state';
import { formatVnDateTime } from '@/lib/dates';
import type { SortDir } from '@/lib/list-params';
import { RUN_TRIGGER_LABELS } from '@/modules/rule-engine/labels';
import type { EvaluationRunListItemDto } from '@/modules/rule-engine/services/evaluation-query.service';
import { RunStatusBadge } from './run-status-badge';

const columns: ColumnDef<EvaluationRunListItemDto>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Thời điểm',
    meta: { sortKey: 'createdAt', mobile: 'title' },
    cell: ({ row }) => (
      <Link href={`/admin/evaluations/${row.original.id}`} className="text-primary hover:underline">
        {formatVnDateTime(row.original.createdAt)}
      </Link>
    ),
  },
  {
    accessorKey: 'termName',
    header: 'Phạm vi',
    cell: ({ row }) =>
      row.original.courseId
        ? `${row.original.termName} · ${row.original.courseId}`
        : row.original.termName,
  },
  {
    accessorKey: 'trigger',
    header: 'Cách chạy',
    cell: ({ row }) =>
      `${RUN_TRIGGER_LABELS[row.original.trigger]}${row.original.triggeredBy ? ` (${row.original.triggeredBy})` : ''}`,
  },
  {
    accessorKey: 'asOf',
    header: 'Mốc dữ liệu',
    meta: { sortKey: 'asOf' },
    cell: ({ row }) => formatVnDateTime(row.original.asOf),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    meta: { sortKey: 'status' },
    cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'processedStudents',
    header: 'Sinh viên',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.processedStudents}/{row.original.totalStudents}
      </span>
    ),
  },
  {
    accessorKey: 'triggerCount',
    header: 'Dấu hiệu phát hiện',
    cell: ({ row }) => <span className="tabular-nums">{row.original.triggerCount}</span>,
  },
];

export function RunsTable({
  data,
  sort,
}: {
  data: EvaluationRunListItemDto[];
  sort: { sort: string | null; dir: SortDir };
}) {
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      serverSort={sort}
      emptyMessage={
        <EmptyState
          icon={Activity}
          title="Chưa có lần chạy đánh giá nào"
          description="Nạp dữ liệu học tập của học kỳ rồi bấm Chạy đánh giá ở khung phía trên."
        />
      }
    />
  );
}
