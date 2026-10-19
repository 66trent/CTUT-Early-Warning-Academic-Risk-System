import { z } from 'zod';

/** Số dòng mỗi trang người dùng chọn được (docs/rules/07). */
export const PAGE_SIZES = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE = 10_000;

export type SortDir = 'asc' | 'desc';

export interface ListParams<S extends string = string> {
  page: number;
  size: number;
  /** Khóa sắp xếp đã kiểm theo danh sách cho phép; null = thứ tự mặc định của danh sách. */
  sort: S | null;
  dir: SortDir;
}

/** Kết quả 1 trang — mọi service danh sách trả cùng dạng này. */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const pageSchema = z.coerce.number().int().min(1).max(MAX_PAGE).catch(1);
const sizeSchema = z.coerce
  .number()
  .int()
  .refine((n) => (PAGE_SIZES as readonly number[]).includes(n))
  .catch(DEFAULT_PAGE_SIZE);

/**
 * Đọc `?page=&size=&sort=&dir=` từ URL. Giá trị sai bị thay bằng mặc định (trang chỉ đọc, không
 * báo lỗi); `sort` chỉ nhận khóa trong `sortKeys` — service ánh xạ khóa sang cột, không nối chuỗi.
 */
export function parseListParams<S extends string>(
  raw: RawSearchParams,
  sortKeys: readonly S[] = [],
  defaults: { sort?: S; dir?: SortDir; size?: number } = {},
): ListParams<S> {
  const sort = first(raw.sort);
  const dir = first(raw.dir);
  const knownSort = sortKeys.find((k) => k === sort) ?? null;
  return {
    page: pageSchema.parse(first(raw.page)),
    size:
      first(raw.size) === undefined
        ? (defaults.size ?? DEFAULT_PAGE_SIZE)
        : sizeSchema.parse(first(raw.size)),
    sort: knownSort ?? defaults.sort ?? null,
    dir: knownSort ? (dir === 'desc' ? 'desc' : 'asc') : (defaults.dir ?? 'asc'),
  };
}

export const pageOffset = (p: Pick<ListParams, 'page' | 'size'>) => (p.page - 1) * p.size;

export const lastPageOf = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

/** Chuỗi truy vấn giữ nguyên bộ lọc hiện tại, chỉ thay các khóa trong `patch` (null = bỏ). */
export function withParams(raw: RawSearchParams, patch: Record<string, string | null>): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const v = first(value);
    if (v !== undefined && v !== '' && !(key in patch)) next.set(key, v);
  }
  for (const [key, value] of Object.entries(patch)) if (value !== null) next.set(key, value);
  const query = next.toString();
  return query ? `?${query}` : '';
}

/** Các số trang hiển thị: 1 … p-1 p p+1 … last (null = dấu ba chấm). */
export function pageWindow(page: number, last: number): (number | null)[] {
  const pages = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : null);
    out.push(p);
  });
  return out;
}

/** Tham số trang đầu — dùng khi gọi service ngoài trang web (test, script). */
export const firstPage = <S extends string>(
  overrides: Partial<ListParams<S>> = {},
): ListParams<S> => ({ page: 1, size: DEFAULT_PAGE_SIZE, sort: null, dir: 'asc', ...overrides });

/** Hướng sắp xếp dạng SQL cho QueryBuilder. */
export const sqlDir = (dir: SortDir) => (dir === 'desc' ? 'DESC' : 'ASC');

type SqlDir = 'ASC' | 'DESC';
interface Orderable {
  orderBy(sort: string, order: SqlDir): unknown;
  addOrderBy(sort: string, order: SqlDir): unknown;
}

/**
 * ORDER BY cột chính rồi các cột phụ (thứ tự ổn định giữa các trang). Bỏ cột phụ trùng cột chính:
 * QueryBuilder lưu ORDER BY theo tên cột, thêm lần 2 sẽ ghi đè hướng của cột chính.
 */
export function applyOrder(
  qb: Orderable,
  primary: string,
  dir: SortDir,
  ...ties: [string, SqlDir][]
): void {
  qb.orderBy(primary, sqlDir(dir));
  for (const [column, order] of ties) if (column !== primary) qb.addOrderBy(column, order);
}

/** `order` cho `repo.find()`: cột chính + cột phụ giảm dần (bỏ khi trùng cột chính). */
export function findOrder<K extends string>(
  primary: K,
  dir: SortDir,
  tie: K,
): Partial<Record<K, SqlDir>> {
  const order: Partial<Record<K, SqlDir>> = { [primary]: sqlDir(dir) } as Partial<
    Record<K, SqlDir>
  >;
  if (tie !== primary) order[tie] = 'DESC';
  return order;
}
