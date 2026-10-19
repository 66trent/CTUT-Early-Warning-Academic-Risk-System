'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { FileUp } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/empty-state';
import { formatVnDateTime } from '@/lib/dates';
import type { SortDir } from '@/lib/list-params';
import type { ImportBatchListItemDto } from '@/modules/data-import/services/import-query.service';
import { BatchStatusBadge } from './batch-status-badge';

const columns: ColumnDef<ImportBatchListItemDto>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Thời điểm',
    meta: { sortKey: 'createdAt' },
    cell: ({ row }) => formatVnDateTime(row.original.createdAt),
  },
  { accessorKey: 'dataTypeLabel', header: 'Loại dữ liệu', meta: { sortKey: 'dataType' } },
  {
    accessorKey: 'termName',
    header: 'Học kỳ',
    cell: ({ row }) => row.original.termName ?? '—',
  },
  {
    accessorKey: 'courseLabel',
    header: 'Học phần',
    cell: ({ row }) => row.original.courseLabel ?? '—',
  },
  {
    accessorKey: 'fileName',
    header: 'File',
    meta: { sortKey: 'fileName', mobile: 'title' },
    cell: ({ row }) => (
      <Link href={`/admin/imports/${row.original.id}`} className="text-primary hover:underline">
        {row.original.fileName}
      </Link>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    meta: { sortKey: 'status' },
    cell: ({ row }) => <BatchStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'successRows',
    header: 'Hợp lệ / Lỗi',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.successRows} / {row.original.errorRows}
      </span>
    ),
  },
];

export function BatchesTable({
  batches,
  sort,
}: {
  batches: ImportBatchListItemDto[];
  sort: { sort: string | null; dir: SortDir };
}) {
  return (
    <DataTable
      columns={columns}
      data={batches}
      getRowId={(b) => b.id}
      serverSort={sort}
      emptyMessage={
        <EmptyState
          icon={FileUp}
          title="Chưa có lần nạp dữ liệu nào"
          description="Bắt đầu bằng danh sách sinh viên ở khung phía trên, sau đó nạp điểm danh và dữ liệu LMS hằng tuần."
        />
      }
    />
  );
}
