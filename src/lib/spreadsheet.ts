import ExcelJS from 'exceljs';

/**
 * Chống chèn công thức (CSV/formula injection, OWASP — docs/rules/06): ô bắt đầu bằng
 * `=`, `+`, `-`, `@`, tab, CR được thêm tiền tố `'` để Excel coi là văn bản.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Ô CSV theo RFC 4180: bọc ngoặc kép khi có dấu phẩy, ngoặc kép hoặc xuống dòng. */
export function csvCell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** BOM để Excel mở CSV UTF-8 đúng tiếng Việt. */
export const BOM = '﻿';

export type SheetRow = Record<string, string | number>;

/** CSV (UTF-8 có BOM, CRLF) — mọi ô chữ đã chống chèn công thức. */
export function toCsv(headers: readonly string[], rows: readonly SheetRow[]): string {
  const line = (cells: readonly (string | number)[]) =>
    cells.map((c) => (typeof c === 'number' ? String(c) : csvCell(c))).join(',');
  return (
    BOM + [line(headers), ...rows.map((r) => line(headers.map((h) => r[h] ?? '')))].join('\r\n')
  );
}

/**
 * File `.xlsx` 1 trang tính: dòng tiêu đề in đậm, cố định dòng đầu, độ rộng cột theo nội dung.
 * Ô chữ ghi kiểu văn bản và đã chống chèn công thức (docs/rules/06).
 */
export async function toXlsx(
  sheetName: string,
  headers: readonly string[],
  rows: readonly SheetRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.min(60, Math.max(h.length, ...rows.map((r) => String(r[h] ?? '').length)) + 2),
  }));
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    const safe: SheetRow = {};
    for (const h of headers) {
      const v = r[h] ?? '';
      safe[h] = typeof v === 'number' ? v : neutralizeFormula(v);
    }
    sheet.addRow(safe);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
