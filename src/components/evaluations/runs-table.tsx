'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Activity } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { SeverityCounts } from '@/components/domain/severity-counts';
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
    cell: ({ row }) => {
      const by = row.original.triggeredBy;
      // Tài khoản ADMIN mặc định trùng với nhãn "Admin chạy" nên không lặp lại.
      return `${RUN_TRIGGER_LABELS[row.original.trigger]}${by && by !== 'ADMIN' ? ` (${by})` : ''}`;
    },
  },
  {
    accessorKey: 'asOf',
    header: 'Tính đến',
    meta: { sortKey: 'asOf' },
    cell: ({ row }) => {
      const sameMoment =
        Math.abs(Date.parse(row.original.asOf) - Date.parse(row.original.createdAt)) < 60_000;
      return sameMoment ? (
        <span className="text-muted-foreground">Lúc chạy</span>
      ) : (
        formatVnDateTime(row.original.asOf)
      );
    },
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
    cell: ({ row }) => <SeverityCounts items={row.original.bySeverity} />,
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
          description="Nhập dữ liệu học tập của học kỳ rồi bấm Chạy đánh giá ở khung phía trên."
        />
      }
    />
  );
}
