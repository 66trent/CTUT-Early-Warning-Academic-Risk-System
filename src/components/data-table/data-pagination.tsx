import Link from 'next/link';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { lastPageOf, pageWindow, type RawSearchParams, withParams } from '@/lib/list-params';
import { PageSizeSelect } from './page-size-select';

interface DataPaginationProps {
  /** Đường dẫn trang danh sách, VD `/admin/users`. */
  basePath: string;
  /** Query hiện tại — giữ nguyên bộ lọc khi chuyển trang. */
  params: RawSearchParams;
  total: number;
  page: number;
  size: number;
  /** Danh từ đếm, VD "tài khoản". */
  unit: string;
  /** Tham số trang riêng khi 1 màn có 2 danh sách (VD `errorPage`). */
  pageParam?: string;
  sizeParam?: string;
}

/** Thanh phân trang dùng chung: "Hiển thị 21–40 / 135" + số trang + chọn số dòng (docs/rules/07). */
export function DataPagination({
  basePath,
  params,
  total,
  page,
  size,
  unit,
  pageParam = 'page',
  sizeParam = 'size',
}: DataPaginationProps) {
  const last = lastPageOf(total, size);
  const href = (p: number) => `${basePath}${withParams(params, { [pageParam]: String(p) })}`;
  const from = total === 0 ? 0 : Math.min(total, (page - 1) * size + 1);
  const to = Math.min(total, page * size);

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span className="tabular-nums">
        {total === 0
          ? `0 ${unit}`
          : page > last
            ? `Trang ${page} không có dữ liệu — có ${total} ${unit} trong ${last} trang. `
            : `Hiển thị ${from}–${to} / ${total} ${unit}`}
        {total > 0 && page > last && (
          <Link href={href(last)} className="text-primary hover:underline">
            Về trang {last}
          </Link>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {total > 0 && (
          <PageSizeSelect
            value={size}
            basePath={basePath}
            params={params}
            pageParam={pageParam}
            sizeParam={sizeParam}
          />
        )}
        {last > 1 && (
          <Pagination className="justify-start sm:justify-end">
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <PaginationPrevious href={href(Math.min(page - 1, last))} />
                </PaginationItem>
              )}
              {pageWindow(Math.min(page, last), last).map((p, i) =>
                p === null ? (
                  <PaginationItem key={`gap-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink href={href(p)} isActive={p === page} className="tabular-nums">
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              {page < last && (
                <PaginationItem>
                  <PaginationNext href={href(page + 1)} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
