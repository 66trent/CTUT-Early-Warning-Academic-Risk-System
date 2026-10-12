import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { FileRejectedError } from '@/modules/data-import/parsing/errors';
import { openRowSource, type RawRow } from '@/modules/data-import/parsing/row-reader';

async function collect(rows: AsyncIterable<RawRow>): Promise<RawRow[]> {
  const out: RawRow[] = [];
  for await (const row of rows) out.push(row);
  return out;
}

/** Chia nhỏ buffer để mô phỏng stream nhiều mảnh (bắt lỗi cắt giữa dòng / giữa ký tự UTF-8). */
function chunked(data: Buffer, size = 7): Readable {
  const parts: Buffer[] = [];
  for (let i = 0; i < data.length; i += size) parts.push(data.subarray(i, i + size));
  return Readable.from(parts);
}

describe('Bộ đọc CSV', () => {
  it('đọc đủ file demo danh sách sinh viên (UTF-8, 13 dòng)', async () => {
    const source = await openRowSource(
      'csv',
      chunked(readFileSync('docs/demo-data/01_sinh_vien.csv')),
    );
    expect(source.headers).toEqual([
      'mssv',
      'ho_ten',
      'email',
      'ma_lop_sinh_hoat',
      'trang_thai_hoc_vu',
    ]);
    const rows = await collect(source.rows);
    expect(rows).toHaveLength(13);
    expect(rows[0]).toEqual({
      rowNumber: 2,
      values: [
        'KTPM2311001',
        'Nguyễn Minh An',
        'an.ktpm2311001@student.ctuet.edu.vn',
        'KTPM2311',
        'ACTIVE',
      ],
    });
    expect(rows.at(-1)?.rowNumber).toBe(14);
  });

  it('bỏ BOM, nhận dấu ; và đánh dấu số thập phân dạng 7,5', async () => {
    const csv = '﻿mssv;diem\r\nSV1;7,5\r\nSV2;"8,0"\r\n';
    const source = await openRowSource('csv', chunked(Buffer.from(csv, 'utf8'), 3));
    expect(source.headers).toEqual(['mssv', 'diem']);
    expect(source.decimalComma).toBe(true);
    expect((await collect(source.rows)).map((r) => r.values)).toEqual([
      ['SV1', '7,5'],
      ['SV2', '8,0'],
    ]);
  });

  it('RFC 4180: ô có dấu phẩy, ngoặc kép, xuống dòng', async () => {
    const csv = 'a,b\n"x, y","he said ""hi"""\n"dòng\nhai",z\n';
    const rows = await collect((await openRowSource('csv', chunked(Buffer.from(csv)))).rows);
    expect(rows.map((r) => r.values)).toEqual([
      ['x, y', 'he said "hi"'],
      ['dòng\nhai', 'z'],
    ]);
  });

  it('bỏ qua dòng trống', async () => {
    const rows = await collect(
      (await openRowSource('csv', Readable.from([Buffer.from('a\n1\n\n2\n')]))).rows,
    );
    expect(rows.map((r) => r.values[0])).toEqual(['1', '2']);
  });
});

describe('Bộ đọc XLSX', () => {
  it('đọc sheet đầu, ô ngày thành YYYY-MM-DD, công thức lấy kết quả', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Dữ liệu');
    sheet.addRow(['Mã SV', 'Ngày chốt', 'Điểm']);
    sheet.addRow(['SV1', new Date(Date.UTC(2026, 9, 2)), 7.5]);
    sheet.addRow(['SV2', '2026-10-09', { formula: '1+1', result: 2 }]);
    workbook.addWorksheet('Bỏ qua').addRow(['khong', 'doc']);
    const data = Buffer.from(await workbook.xlsx.writeBuffer());

    const source = await openRowSource('xlsx', Readable.from(data));
    expect(source.headers).toEqual(['Mã SV', 'Ngày chốt', 'Điểm']);
    expect((await collect(source.rows)).map((r) => r.values)).toEqual([
      ['SV1', '2026-10-02', '7.5'],
      ['SV2', '2026-10-09', '2'],
    ]);
  });
});

describe('Giới hạn', () => {
  it('quá 50.000 dòng → từ chối cả file', async () => {
    const csv = 'a\n' + '1\n'.repeat(50_001);
    const source = await openRowSource('csv', Readable.from([Buffer.from(csv)]));
    await expect(collect(source.rows)).rejects.toBeInstanceOf(FileRejectedError);
  });
});
