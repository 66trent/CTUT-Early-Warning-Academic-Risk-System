/**
 * Sinh file mẫu Excel `.xlsx` từ các file mẫu CSV trong `public/templates/` (npm run templates:build).
 * Excel mở `.xlsx` luôn đúng tiếng Việt và giữ ô ngày là ngày thật — tránh 2 lỗi hay gặp khi
 * người dùng mở/lưu lại CSV bằng Excel: mất dấu và ngày bị đổi sang kiểu Mỹ (docs/rules/12).
 */
import ExcelJS from 'exceljs';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DIR = 'public/templates';
const DATE_COLUMNS = new Set(['ngay_chot', 'ngay_cong_bo', 'han_nop']);
const DATETIME_COLUMNS = new Set(['thoi_diem_bat_dau', 'thoi_diem_nop']);
/** Cột mã/văn bản — giữ dạng chữ để Excel không tự đổi (VD bỏ số 0 đầu). */
const TEXT_COLUMNS = new Set([
  'mssv',
  'ho_ten',
  'email',
  'ma_lop_sinh_hoat',
  'trang_thai_hoc_vu',
  'ma_hoc_phan',
  'ten_hoc_phan',
  'ma_lop_hoc_phan',
  'ma_bai',
  'ten_bai',
  'trang_thai',
  'trang_thai_nop',
  'ho_dem',
  'ten',
  'duoc_du_thi',
  'vang_thi',
  'diem_chu',
  'ket_qua',
  'hoc_ky',
]);

/** `YYYY-MM-DD[ HH:mm]` → Date mà exceljs ghi đúng ngày giờ đó (bộ đọc lấy theo UTC). */
function toExcelDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(text);
  if (!match) return null;
  const [, y, m, d, hh = '0', mm = '0'] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)));
}

function cellValue(column: string, text: string): ExcelJS.CellValue {
  if (text === '') return null;
  if (DATE_COLUMNS.has(column) || DATETIME_COLUMNS.has(column)) return toExcelDate(text) ?? text;
  if (TEXT_COLUMNS.has(column)) return text;
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

async function buildTemplate(csvFile: string): Promise<string> {
  const lines = readFileSync(path.join(DIR, csvFile), 'utf8')
    .replace(/^﻿/, '')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(','));
  const [header = [], ...rows] = lines;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Du lieu', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = header.map((name) => ({
    header: name,
    key: name,
    width: Math.max(12, name.length + 4),
    style: DATETIME_COLUMNS.has(name)
      ? { numFmt: 'yyyy-mm-dd hh:mm' }
      : DATE_COLUMNS.has(name)
        ? { numFmt: 'yyyy-mm-dd' }
        : TEXT_COLUMNS.has(name)
          ? { numFmt: '@' }
          : {},
  }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(header.map((name, i) => cellValue(name, row[i] ?? '')));
  }
  const target = csvFile.replace(/\.csv$/, '.xlsx');
  await workbook.xlsx.writeFile(path.join(DIR, target));
  return target;
}

async function main() {
  const csvFiles = readdirSync(DIR).filter((f) => f.endsWith('.csv'));
  for (const file of csvFiles) {
    process.stdout.write(`templates:build — ${await buildTemplate(file)}\n`);
  }
}

void main();
