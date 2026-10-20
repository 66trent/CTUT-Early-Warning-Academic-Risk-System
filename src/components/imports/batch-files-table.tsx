'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';

export interface BatchFileView {
  fileName: string;
  sizeLabel: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  /** Tên học phần nhận diện được trong file. */
  courses: string[];
}

const columns: ColumnDef<BatchFileView>[] = [
  {
    accessorKey: 'fileName',
    header: 'File',
    enableSorting: false,
    meta: { mobile: 'title' },
    cell: ({ row }) => (
      <span className="inline-flex flex-col">
        <span className="font-medium break-all">{row.original.fileName}</span>
        <span className="text-xs text-muted-foreground">{row.original.sizeLabel}</span>
      </span>
    ),
  },
  {
    accessorKey: 'courses',
    header: 'Học phần',
    enableSorting: false,
    cell: ({ row }) => (row.original.courses.length ? row.original.courses.join(', ') : '—'),
  },
  {
    accessorKey: 'totalRows',
    header: 'Số dòng',
    enableSorting: false,
    cell: ({ row }) => <span className="tabular-nums">{row.original.totalRows}</span>,
  },
  {
    accessorKey: 'successRows',
    header: 'Hợp lệ',
    enableSorting: false,
    cell: ({ row }) => <span className="tabular-nums">{row.original.successRows}</span>,
  },
  {
    accessorKey: 'errorRows',
    header: 'Lỗi',
    enableSorting: false,
    cell: ({ row }) => (
      <span
        className={
          row.original.errorRows > 0
            ? 'font-medium text-destructive tabular-nums'
            : 'text-muted-foreground tabular-nums'
        }
      >
        {row.original.errorRows}
      </span>
    ),
  },
];

/** Tóm tắt từng file của lô nhiều file (docs/rules/12 — Phase 8f). */
export function BatchFilesTable({ files }: { files: BatchFileView[] }) {
  return (
    <DataTable
      columns={columns}
      data={files}
      getRowId={(f) => f.fileName}
      emptyMessage="Lô chưa có file nào."
    />
  );
}
