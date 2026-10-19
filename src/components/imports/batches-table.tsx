'use client';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { formatVnDateTime } from '@/lib/dates';
import type { ImportBatchListItemDto } from '@/modules/data-import/services/import-query.service';
import { BatchStatusBadge } from './batch-status-badge';

const columns: ColumnDef<ImportBatchListItemDto>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Thời điểm',
    cell: ({ row }) => formatVnDateTime(row.original.createdAt),
  },
  { accessorKey: 'dataTypeLabel', header: 'Loại dữ liệu' },
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
    cell: ({ row }) => (
      <Link href={`/admin/imports/${row.original.id}`} className="text-primary hover:underline">
        {row.original.fileName}
      </Link>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
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

export function BatchesTable({ batches }: { batches: ImportBatchListItemDto[] }) {
  return (
    <DataTable
      columns={columns}
      data={batches}
      getRowId={(b) => b.id}
      emptyMessage="Chưa có lần nạp dữ liệu nào. Bắt đầu bằng danh sách sinh viên."
    />
  );
}
