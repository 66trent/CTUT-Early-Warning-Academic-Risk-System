import ExcelJS from 'exceljs';
import { parse as createCsvParser } from 'csv-parse';
import { type Readable } from 'node:stream';
import { FileRejectedError, IMPORT_LIMITS } from './errors';
import { type ImportFileKind } from './file-sniff';

/** 1 dòng dữ liệu thô — `rowNumber` theo file gốc (dòng header = 1). */
export interface RawRow {
  rowNumber: number;
  values: string[];
}

export interface RowSource {
  headers: string[];
  /** true khi file dùng `,` làm dấu thập phân (CSV phân cách `;`). */
  decimalComma: boolean;
  rows: AsyncIterable<RawRow>;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Đếm dấu phân cách ở dòng đầu (bỏ qua phần trong ngoặc kép). */
function detectDelimiter(firstLine: string): ',' | ';' {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') commas += 1;
    else if (!quoted && char === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

type ChunkIterator = AsyncIterator<Buffer | string>;

const toBuffer = (chunk: Buffer | string) =>
  typeof chunk === 'string' ? Buffer.from(chunk) : chunk;

/** Đọc vài mảnh đầu đến hết dòng 1 để đoán dấu phân cách — dùng CHUNG iterator, không hủy stream. */
async function peekFirstLine(
  chunks: ChunkIterator,
): Promise<{ firstLine: string; buffered: Buffer }> {
  const parts: Buffer[] = [];
  for (let next = await chunks.next(); !next.done; next = await chunks.next()) {
    parts.push(toBuffer(next.value));
    const text = Buffer.concat(parts).toString('utf8');
    const newline = text.search(/\r?\n/);
    if (newline !== -1 || text.length > 64_000) {
      return {
        firstLine: newline === -1 ? text : text.slice(0, newline),
        buffered: Buffer.concat(parts),
      };
    }
  }
  const buffered = Buffer.concat(parts);
  return { firstLine: buffered.toString('utf8'), buffered };
}

interface CsvRecord {
  record: string[];
  info: { lines: number };
}

/** Bơm các mảnh còn lại vào csv-parse (stream, có backpressure), trả về từng bản ghi kèm số dòng. */
async function* csvRecords(
  chunks: ChunkIterator,
  prefix: Buffer,
  delimiter: string,
): AsyncIterable<CsvRecord> {
  const parser = createCsvParser({
    delimiter,
    bom: true,
    info: true,
    relax_column_count: true,
    skip_empty_lines: true,
    skip_records_with_empty_values: true,
  });
  const pump = async () => {
    const write = async (chunk: Buffer) => {
      if (!parser.write(chunk)) await new Promise((resolve) => parser.once('drain', resolve));
    };
    if (prefix.length > 0) await write(prefix);
    for (let next = await chunks.next(); !next.done; next = await chunks.next()) {
      await write(toBuffer(next.value));
    }
    parser.end();
  };
  pump().catch((error: unknown) =>
    parser.destroy(error instanceof Error ? error : new Error(String(error))),
  );
  try {
    for await (const item of parser as AsyncIterable<CsvRecord>) yield item;
  } catch (error) {
    throw new FileRejectedError(
      `File CSV sai cấu trúc (${error instanceof Error ? error.message : 'không đọc được'}). Kiểm tra dấu ngoặc kép.`,
    );
  }
}

/** CSV theo stream (RFC 4180, BOM, `,` hoặc `;`). `rowNumber` = số dòng trong file (header = 1). */
async function openCsv(stream: Readable): Promise<RowSource> {
  const chunks = (stream as AsyncIterable<Buffer | string>)[Symbol.asyncIterator]();
  const { firstLine, buffered } = await peekFirstLine(chunks);
  const delimiter = detectDelimiter(firstLine.replace(/^﻿/, ''));
  const records = csvRecords(chunks, buffered, delimiter)[Symbol.asyncIterator]();
  const header = await records.next();
  if (header.done) throw new FileRejectedError('File không có dòng tiêu đề.');

  async function* rows(): AsyncIterable<RawRow> {
    for (let next = await records.next(); !next.done; next = await records.next()) {
      yield { rowNumber: next.value.info.lines, values: next.value.record.map((v) => v.trim()) };
    }
  }
  return { headers: header.value.record, decimalComma: delimiter === ';', rows: rows() };
}

/** Giá trị ô Excel → chuỗi. Ngày → `YYYY-MM-DD[ HH:mm]`; công thức → kết quả đã lưu (không tính lại). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const date = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    const hasTime = value.getUTCHours() !== 0 || value.getUTCMinutes() !== 0;
    return hasTime ? `${date} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}` : date;
  }
  if (typeof value === 'object') {
    if ('richText' in value)
      return value.richText
        .map((part) => part.text)
        .join('')
        .trim();
    if ('result' in value) return cellText(value.result);
    if ('text' in value) return String(value.text).trim();
    if ('error' in value) return '';
    return '';
  }
  return String(value).trim();
}

async function readAll(stream: Readable): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) parts.push(toBuffer(chunk));
  return Buffer.concat(parts);
}

/**
 * XLSX — chỉ sheet đầu tiên, chỉ giá trị ô (docs/rules/12). Đọc cả file vào bộ nhớ (ngoại lệ của
 * docs/rules/05): bản stream của exceljs bỏ sót dữ liệu tùy thứ tự mục trong file nén. Bộ nhớ có
 * trần nhờ giới hạn 20MB / 100MB giải nén / 50.000 dòng (đo: ~270MB heap ở mức trần).
 */
async function openXlsx(stream: Readable): Promise<RowSource> {
  const workbook = new ExcelJS.Workbook();
  try {
    const data = await readAll(stream);
    // exceljs khai báo tham số là ArrayBuffer → truyền đúng vùng nhớ của Buffer.
    await workbook.xlsx.load(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
    );
  } catch {
    throw new FileRejectedError(
      'Không đọc được file Excel. Hãy mở bằng Excel và lưu lại dạng .xlsx.',
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new FileRejectedError('File Excel không có sheet nào.');
  const toValues = (row: ExcelJS.Row) =>
    Array.from({ length: Math.max(0, row.cellCount) }, (_, i) =>
      cellText(row.getCell(i + 1).value),
    );

  const headerRow = sheet.getRow(1);
  if (headerRow.cellCount === 0) throw new FileRejectedError('File không có dòng tiêu đề.');
  const lastRow = sheet.rowCount;

  async function* rows(): AsyncIterable<RawRow> {
    for (let number = 2; number <= lastRow; number += 1) {
      const values = toValues(sheet.getRow(number));
      if (values.some((v) => v !== '')) yield { rowNumber: number, values };
    }
    await Promise.resolve();
  }
  return { headers: toValues(headerRow), decimalComma: false, rows: rows() };
}

/**
 * Giới hạn số dòng dữ liệu (docs/rules/12): `maxRows` = số dòng còn lại của cả lô (lô nhiều file
 * dùng chung trần 50.000 dòng).
 */
async function* limitRows(rows: AsyncIterable<RawRow>, maxRows: number): AsyncIterable<RawRow> {
  let count = 0;
  for await (const row of rows) {
    count += 1;
    if (count > maxRows) {
      throw new FileRejectedError(
        `Lô có hơn ${IMPORT_LIMITS.maxDataRows.toLocaleString('vi-VN')} dòng dữ liệu. Hãy tách thành nhiều file hoặc nhiều lần nạp.`,
      );
    }
    yield row;
  }
}

export async function openRowSource(
  kind: ImportFileKind,
  stream: Readable,
  maxRows: number = IMPORT_LIMITS.maxDataRows,
): Promise<RowSource> {
  const source = kind === 'csv' ? await openCsv(stream) : await openXlsx(stream);
  return { ...source, rows: limitRows(source.rows, maxRows) };
}

/** Số dòng đầu file được dò để tìm dòng tiêu đề (docs/rules/12). */
export const HEADER_SCAN_ROWS = 10;

/**
 * Dòng tiêu đề = dòng đầu tiên trong 10 dòng đầu có đủ cột bắt buộc `isHeader` — để dán cả vùng
 * bảng có dòng tiêu đề phụ phía trên (VD tên lớp học phần). Các dòng trước tiêu đề bị bỏ qua;
 * số dòng báo lỗi vẫn là số dòng thật trong file.
 */
export async function locateHeader(
  source: RowSource,
  isHeader: (headers: string[]) => boolean,
): Promise<RowSource> {
  if (isHeader(source.headers)) return source;
  const iterator = source.rows[Symbol.asyncIterator]();
  for (let i = 1; i < HEADER_SCAN_ROWS; i += 1) {
    const next = await iterator.next();
    if (next.done) break;
    if (isHeader(next.value.values)) {
      return {
        ...source,
        headers: next.value.values,
        rows: { [Symbol.asyncIterator]: () => iterator },
      };
    }
  }
  return source;
}
