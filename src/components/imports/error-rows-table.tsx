'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';

export interface ErrorRowView {
  sourceRowNumber: number;
  reasonLabel: string;
  errorDetail: string | null;
  rawData: Record<string, string>;
}

/** Dòng lỗi của lô nhập — cột theo đúng thứ tự cột của file gốc. */
export function ErrorRowsTable({ rows, headers }: { rows: ErrorRowView[]; headers: string[] }) {
  const columns: ColumnDef<ErrorRowView>[] = [
    {
      accessorKey: 'sourceRowNumber',
      header: 'Dòng',
      enableSorting: false,
      meta: { mobile: 'title' },
      cell: ({ row }) => <span className="tabular-nums">Dòng {row.original.sourceRowNumber}</span>,
    },
    {
      accessorKey: 'reasonLabel',
      header: 'Lý do lỗi',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="inline-flex flex-col">
          <span className="w-fit rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            {row.original.reasonLabel}
          </span>
          {row.original.errorDetail && (
            <span className="mt-1 text-xs text-muted-foreground">{row.original.errorDetail}</span>
          )}
        </span>
      ),
    },
    ...headers.map((h): ColumnDef<ErrorRowView> => ({
      id: `raw:${h}`,
      header: h,
      enableSorting: false,
      cell: ({ row }) => row.original.rawData[h],
    })),
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.sourceRowNumber)}
      emptyMessage="Trang này không có dòng lỗi."
    />
  );
}
