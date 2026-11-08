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
import { Fragment, type ReactNode, useState } from 'react';
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
    /**
     * Dạng thẻ: `title` = tiêu đề thẻ, `lead` = cùng hàng tiêu đề (bên trái), `plain` = cả dòng, không
     * có nhãn, `footer` = cuối thẻ (nút thao tác), `hide` = ẩn.
     */
    mobile?: 'title' | 'lead' | 'plain' | 'footer' | 'hide';
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
  /** Class thêm cho từng dòng (bảng) và thẻ (điện thoại). */
  rowClassName?: (row: TData) => string | undefined;
  /** Bấm cả dòng / thẻ. Vẫn cần 1 phần tử bấm được trong dòng cho người dùng bàn phím. */
  onRowClick?: (row: TData) => void;
  /** Nhãn nhóm: dòng đổi nhãn so với dòng trước thì chèn 1 hàng tiêu đề nhóm; `null` = không gom. */
  groupLabel?: (row: TData) => string | null;
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
  rowClassName,
  onRowClick,
  groupLabel,
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
  /** Nhãn nhóm của dòng thứ `i` nếu dòng này mở đầu 1 nhóm mới. */
  const groupStart = (i: number): string | null => {
    const row = rows[i];
    if (!groupLabel || !row) return null;
    const label = groupLabel(row.original);
    const before = rows[i - 1];
    return label !== null && (!before || groupLabel(before.original) !== label) ? label : null;
  };
  const clickable = onRowClick ? 'cursor-pointer hover:bg-primary-soft' : undefined;
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
              rows.map((row, i) => {
                const group = groupStart(i);
                return (
                  <Fragment key={row.id}>
                    {group && (
                      <TableRow className="bg-secondary hover:bg-secondary">
                        <TableCell
                          colSpan={columns.length}
                          className="py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                        >
                          {group}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow
                      className={cn('even:bg-muted', clickable, rowClassName?.(row.original))}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label="Danh sách">
        {rows.length === 0 && <li className="rounded-md border">{empty}</li>}
        {rows.map((row, rowIndex) => {
          const group = groupStart(rowIndex);
          const cells = row.getVisibleCells();
          const marked = cells.some((c) => c.column.columnDef.meta?.mobile === 'title');
          const kind = (c: Cell<TData, unknown>, i: number) =>
            c.column.columnDef.meta?.mobile ??
            (c.column.id === 'actions' ? 'footer' : !marked && i === 0 ? 'title' : 'field');
          const render = (c: Cell<TData, unknown>) =>
            flexRender(c.column.columnDef.cell, c.getContext());
          return (
            <Fragment key={row.id}>
              {group && (
                <li className="pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group}
                </li>
              )}
              <li
                className={cn(
                  'flex flex-col gap-2 rounded-md border bg-card p-3 text-sm',
                  clickable,
                  rowClassName?.(row.original),
                )}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                <div className="flex items-start gap-2">
                  {cells.map((c, i) =>
                    kind(c, i) === 'lead' ? (
                      <div key={c.id} className="shrink-0">
                        {render(c)}
                      </div>
                    ) : null,
                  )}
                  {cells.map((c, i) =>
                    kind(c, i) === 'title' ? (
                      <div key={c.id} className="min-w-0 font-medium">
                        {render(c)}
                      </div>
                    ) : null,
                  )}
                </div>
                {cells.map((c, i) =>
                  kind(c, i) === 'plain' ? <div key={c.id}>{render(c)}</div> : null,
                )}
                <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 empty:hidden">
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
                    <div
                      key={c.id}
                      className={cn('flex flex-wrap justify-end gap-2 border-t pt-2')}
                    >
                      {render(c)}
                    </div>
                  ) : null,
                )}
              </li>
            </Fragment>
          );
        })}
      </ul>
    </>
  );
}
