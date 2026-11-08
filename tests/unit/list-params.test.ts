import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  firstPage,
  lastPageOf,
  pageOffset,
  pageWindow,
  parseListParams,
  withParams,
} from '@/lib/list-params';

const KEYS = ['fullName', 'classId'] as const;

describe('parseListParams — đọc phân trang và sắp xếp từ URL', () => {
  it('mặc định trang 1, 20 dòng, không sắp xếp', () => {
    expect(parseListParams({}, KEYS)).toEqual({
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      sort: null,
      dir: 'asc',
    });
  });

  it('nhận giá trị hợp lệ', () => {
    expect(parseListParams({ page: '3', size: '50', sort: 'classId', dir: 'desc' }, KEYS)).toEqual({
      page: 3,
      size: 50,
      sort: 'classId',
      dir: 'desc',
    });
  });

  it('giá trị sai bị thay bằng mặc định; khóa sắp xếp lạ bị bỏ (chống chèn cột)', () => {
    const p = parseListParams(
      { page: '-2', size: '7', sort: 'u.password; DROP', dir: 'sideways' },
      KEYS,
      { sort: 'fullName', dir: 'desc' },
    );
    expect(p).toEqual({ page: 1, size: 20, sort: 'fullName', dir: 'desc' });
  });

  it('size mặc định riêng của danh sách khi URL không có size', () => {
    expect(parseListParams({}, [], { size: 50 }).size).toBe(50);
    expect(parseListParams({ size: '100' }, [], { size: 50 }).size).toBe(100);
  });

  it('mảng (khóa lặp) → lấy giá trị đầu', () => {
    expect(parseListParams({ page: ['2', '9'] }, KEYS).page).toBe(2);
  });
});

describe('tính trang', () => {
  it('offset, trang cuối', () => {
    expect(pageOffset({ page: 3, size: 20 })).toBe(40);
    expect(lastPageOf(0, 20)).toBe(1);
    expect(lastPageOf(41, 20)).toBe(3);
    expect(firstPage({ size: 100 })).toMatchObject({ page: 1, size: 100 });
  });

  it('dãy số trang có dấu ba chấm, khoảng trống 1 trang thì hiện số', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
  });

  it('giữ bộ lọc khi đổi trang, bỏ khóa có giá trị null', () => {
    expect(withParams({ q: 'an', page: '2', role: '' }, { page: '3' })).toBe('?q=an&page=3');
    expect(withParams({ q: 'an', page: '2' }, { page: null, size: '50' })).toBe('?q=an&size=50');
    expect(withParams({}, { page: null })).toBe('');
  });
});
