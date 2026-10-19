'use client';

import {
  type Cell,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type Header,
  type RowData,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SortDir } from '@/lib/list-params';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- chữ ký bắt buộc của TanStack
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Nhãn ở dạng thẻ trên điện thoại khi `header` không phải chuỗi. */
    label?: string;
    /** Dạng thẻ: `title` = tiêu đề thẻ, `footer` = cuối thẻ (nút thao tác), `hide` = ẩn. */
    mobile?: 'title' | 'footer' | 'hide';
    /** Khóa sắp xếp phía server — có thì tiêu đề cột bấm được khi bảng dùng `serverSort`. */
    sortKey?: string;
  }
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  /** Lời nhắn có ý nghĩa khi bảng rỗng (docs/rules/07) — chuỗi hoặc `EmptyState`. */
  emptyMessage: ReactNode;
  getRowId?: (row: TData) => string;
  /**
   * Sắp xếp phía server theo URL (`?sort=&dir=`) — bảng có phân trang. Không truyền = sắp xếp trong
   * trang hiện tại (danh sách ngắn).
   */
  serverSort?: { sort: string | null; dir: SortDir };
}

function headerLabel<TData>(header: Header<TData, unknown>): ReactNode {
  return header.isPlaceholder
    ? null
    : flexRender(header.column.columnDef.header, header.getContext());
}

function cellLabel<TData>(cell: Cell<TData, unknown>): string {
  const { header, meta } = cell.column.columnDef;
  return meta?.label ?? (typeof header === 'string' ? header : '');
}

function SortIcon({ dir }: { dir: false | SortDir }) {
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown;
  return <Icon aria-hidden className="size-3.5" />;
}

/**
 * Bảng dùng chung: @tanstack/react-table + shadcn Table (docs/rules/03). Màn hình < 768px mỗi dòng
 * thành 1 thẻ, không cuộn ngang (docs/rules/07).
 */
export function DataTable<TData>({
  columns,
  data,
  emptyMessage,
  getRowId,
  serverSort,
}: DataTableProps<TData>) {
  const router = useRouter();
  const pathname = usePathname();
  const [sorting, setSorting] = useState<SortingState>([]);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table chưa hỗ trợ React Compiler
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: !!serverSort,
  });

  const sortBy = (key: string) => {
    const query = new URLSearchParams(window.location.search);
    const dir = serverSort?.sort === key && serverSort.dir === 'asc' ? 'desc' : 'asc';
    query.set('sort', key);
    query.set('dir', dir);
    query.delete('page');
    router.push(`${pathname}?${query.toString()}`);
  };

  const renderHead = (header: Header<TData, unknown>) => {
    const key = header.column.columnDef.meta?.sortKey;
    if (serverSort && key) {
      const dir = serverSort.sort === key ? serverSort.dir : false;
      return (
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => sortBy(key)}
          aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
        >
          {headerLabel(header)}
          <SortIcon dir={dir} />
        </button>
      );
    }
    if (!serverSort && header.column.getCanSort()) {
      return (
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={header.column.getToggleSortingHandler()}
        >
          {headerLabel(header)}
          <SortIcon dir={header.column.getIsSorted()} />
        </button>
      );
    }
    return headerLabel(header);
  };

  const rows = table.getRowModel().rows;
  const empty = (
    <div className="flex min-h-24 items-center justify-center p-4 text-center text-muted-foreground">
      {emptyMessage}
    </div>
  );

  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {renderHead(header)}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0 whitespace-normal">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="even:bg-muted">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label="Danh sách">
        {rows.length === 0 && <li className="rounded-md border">{empty}</li>}
        {rows.map((row) => {
          const cells = row.getVisibleCells();
          const marked = cells.some((c) => c.column.columnDef.meta?.mobile === 'title');
          const kind = (c: Cell<TData, unknown>, i: number) =>
            c.column.columnDef.meta?.mobile ??
            (c.column.id === 'actions' ? 'footer' : !marked && i === 0 ? 'title' : 'field');
          const render = (c: Cell<TData, unknown>) =>
            flexRender(c.column.columnDef.cell, c.getContext());
          return (
            <li key={row.id} className="flex flex-col gap-2 rounded-md border bg-card p-3 text-sm">
              {cells.map((c, i) =>
                kind(c, i) === 'title' ? (
                  <div key={c.id} className="font-medium">
                    {render(c)}
                  </div>
                ) : null,
              )}
              <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1">
                {cells.map((c, i) =>
                  kind(c, i) === 'field' ? (
                    <div key={c.id} className="contents">
                      <dt className="text-muted-foreground">{cellLabel(c)}</dt>
                      <dd className="min-w-0 break-words">{render(c)}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
              {cells.map((c, i) =>
                kind(c, i) === 'footer' ? (
                  <div key={c.id} className={cn('flex flex-wrap justify-end gap-2 border-t pt-2')}>
                    {render(c)}
                  </div>
                ) : null,
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
