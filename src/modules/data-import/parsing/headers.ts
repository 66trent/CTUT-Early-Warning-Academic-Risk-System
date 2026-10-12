import { stripDiacritics } from './values';

/** Bí danh phổ biến → tên cột chuẩn (docs/rules/12). */
const ALIASES: Record<string, string> = {
  ma_sv: 'mssv',
  ma_so_sv: 'mssv',
  ma_sinh_vien: 'mssv',
  ma_so_sinh_vien: 'mssv',
  ho_va_ten: 'ho_ten',
  lop_sinh_hoat: 'ma_lop_sinh_hoat',
  ma_lop: 'ma_lop_sinh_hoat',
  trang_thai: 'trang_thai',
};

/** `Mã học phần` → `ma_hoc_phan`: bỏ dấu, chữ thường, ký tự khác chữ/số → `_`, rồi tra bí danh. */
export function normalizeHeader(raw: string): string {
  const base = stripDiacritics(raw.replace(/^﻿/, ''))
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return ALIASES[base] ?? base;
}

export interface HeaderMap {
  /** Vị trí cột (0-based) của từng tên chuẩn. */
  index: Map<string, number>;
  /** Header gốc theo thứ tự — để xuất lại dòng lỗi đúng như file người dùng. */
  original: string[];
}

export function buildHeaderMap(rawHeaders: string[]): HeaderMap {
  const index = new Map<string, number>();
  rawHeaders.forEach((header, i) => {
    const name = normalizeHeader(header);
    if (name && !index.has(name)) index.set(name, i);
  });
  return { index, original: rawHeaders.map((h) => h.replace(/^﻿/, '').trim()) };
}

/** Cột bắt buộc còn thiếu (theo tên chuẩn). */
export function missingColumns(map: HeaderMap, required: readonly string[]): string[] {
  return required.filter((column) => !map.index.has(column));
}
