'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { FileUp } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { formatVnDateTime } from '@/lib/dates';
import type { SortDir } from '@/lib/list-params';
import type { ImportBatchListItemDto } from '@/modules/data-import/services/import-query.service';
import { BatchStatusBadge } from './batch-status-badge';

const columns: ColumnDef<ImportBatchListItemDto>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Thời điểm',
    meta: { sortKey: 'createdAt' },
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span className="tabular-nums">{formatVnDateTime(row.original.createdAt)}</span>
        <span className="text-xs text-muted-foreground">{row.original.termName ?? '—'}</span>
      </span>
    ),
  },
  { accessorKey: 'dataTypeLabel', header: 'Loại dữ liệu', meta: { sortKey: 'dataType' } },
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
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/admin/imports/${row.original.id}`}
          title={row.original.fileName}
          className="block max-w-full truncate text-primary hover:underline md:max-w-56"
        >
          {row.original.fileName}
        </Link>
        {(row.original.fileCount > 1 || row.original.fromMoodle) && (
          <span className="flex items-center gap-2">
            {row.original.fileCount > 1 && (
              <span className="text-xs text-muted-foreground">
                + {row.original.fileCount - 1} file khác
              </span>
            )}
            {row.original.fromMoodle && <Badge variant="outline">Moodle</Badge>}
          </span>
        )}
      </span>
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
        {row.original.successRows} /{' '}
        <span className={row.original.errorRows > 0 ? 'font-semibold text-destructive' : undefined}>
          {row.original.errorRows}
        </span>
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
          title="Chưa có lần nhập dữ liệu nào"
          description="Bắt đầu bằng danh sách sinh viên ở khung phía trên, sau đó nhập điểm danh và dữ liệu LMS hằng tuần."
        />
      }
    />
  );
}
