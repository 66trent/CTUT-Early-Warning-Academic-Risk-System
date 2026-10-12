'use client';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { formatVnDateTime } from '@/lib/dates';
import { RUN_TRIGGER_LABELS } from '@/modules/rule-engine/labels';
import type { EvaluationRunListItemDto } from '@/modules/rule-engine/services/evaluation-query.service';
import { RunStatusBadge } from './run-status-badge';

const columns: ColumnDef<EvaluationRunListItemDto>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Thời điểm',
    cell: ({ row }) => (
      <Link href={`/admin/evaluations/${row.original.id}`} className="text-primary hover:underline">
        {formatVnDateTime(row.original.createdAt)}
      </Link>
    ),
  },
  { accessorKey: 'termName', header: 'Học kỳ' },
  {
    accessorKey: 'trigger',
    header: 'Cách chạy',
    cell: ({ row }) =>
      `${RUN_TRIGGER_LABELS[row.original.trigger]}${row.original.triggeredBy ? ` (${row.original.triggeredBy})` : ''}`,
  },
  {
    accessorKey: 'asOf',
    header: 'Mốc dữ liệu',
    cell: ({ row }) => formatVnDateTime(row.original.asOf),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
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

export function RunsTable({ data }: { data: EvaluationRunListItemDto[] }) {
  return <DataTable columns={columns} data={data} emptyMessage="Chưa có lần chạy đánh giá nào." />;
}
