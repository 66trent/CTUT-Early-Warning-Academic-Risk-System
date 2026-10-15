import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { FileRejectedError } from '@/modules/data-import/parsing/errors';
import { sniffImportFile, zipUncompressedSize } from '@/modules/data-import/parsing/file-sniff';
import {
  buildHeaderMap,
  missingColumns,
  normalizeHeader,
} from '@/modules/data-import/parsing/headers';
import { parseDate, parseDateTime, parseDecimal } from '@/modules/data-import/parsing/values';

describe('Chuẩn hóa ngày — giờ Việt Nam, không đoán ngày mơ hồ', () => {
  it.each([
    ['2026-10-05', '2026-10-05'],
    ['2026-1-5', '2026-01-05'],
    ['05/10/2026', '2026-10-05'],
    ['13/10/2026', '2026-10-13'],
    ['5/5/2026', '2026-05-05'],
  ])('%s → %s', (raw, expected) => {
    expect(parseDate(raw)).toEqual({ ok: true, value: expected });
  });

  it.each(['10/2/2026', '9/14/2026', '6/10/2026'])(
    '%s (kiểu Mỹ do Excel tự đổi) bị từ chối kèm hướng dẫn',
    (raw) => {
      const result = parseDate(raw);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.message).toContain('YYYY-MM-DD');
    },
  );

  it.each(['2026-02-30', '31/04/2026', 'hôm qua'])('%s không hợp lệ', (raw) => {
    expect(parseDate(raw).ok).toBe(false);
  });

  it('ngày giờ nhiều dạng → cùng 1 mốc giờ Việt Nam', () => {
    for (const raw of [
      '2026-09-14 08:00',
      '14/09/2026 08:00',
      '08:00 14/09/2026',
      '2026-09-14 8:00:00',
    ]) {
      expect(parseDateTime(raw)).toEqual({ ok: true, value: '2026-09-14T08:00:00+07:00' });
    }
    expect(parseDateTime('2026-09-14 25:00').ok).toBe(false);
    expect(parseDateTime('9/14/2026 8:00').ok).toBe(false);
  });
});

describe('Chuẩn hóa số', () => {
  it('7,5 chỉ hiểu là 7.5 khi file dùng dấu phẩy thập phân', () => {
    expect(parseDecimal('7,5', true)).toEqual({ ok: true, value: 7.5 });
    expect(parseDecimal('7,5', false).ok).toBe(false);
    expect(parseDecimal('7.5', true)).toEqual({ ok: true, value: 7.5 });
    expect(parseDecimal('abc', false).ok).toBe(false);
  });
});

describe('Header có dấu / không dấu', () => {
  it.each([
    ['Mã học phần', 'ma_hoc_phan'],
    ['﻿mssv', 'mssv'],
    ['Mã SV', 'mssv'],
    ['Mã số sinh viên', 'mssv'],
    ['Họ và tên', 'ho_ten'],
    ['  Ngày chốt ', 'ngay_chot'],
    ['Đi trễ', 'di_tre'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeHeader(raw)).toBe(expected);
  });

  it('báo đúng cột bắt buộc còn thiếu, giữ header gốc', () => {
    const map = buildHeaderMap(['Mã SV', 'Họ tên', 'Ghi chú']);
    expect(missingColumns(map, ['mssv', 'ho_ten', 'email'])).toEqual(['email']);
    expect(map.original).toEqual(['Mã SV', 'Họ tên', 'Ghi chú']);
  });
});

describe('Kiểm tra file theo nội dung thật', () => {
  it('nhận CSV UTF-8 và XLSX thật', async () => {
    expect(sniffImportFile('a.csv', Buffer.from('mssv\nSV1\n'))).toBe('csv');
    const zip = new JSZip();
    zip.file('xl/workbook.xml', '<workbook/>');
    expect(sniffImportFile('a.xlsx', await zip.generateAsync({ type: 'nodebuffer' }))).toBe('xlsx');
  });

  it.each([
    ['đuôi .xlsx nhưng là văn bản', 'a.xlsx', Buffer.from('mssv\n')],
    ['đuôi .csv nhưng là nhị phân', 'a.csv', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])],
    ['CSV không phải UTF-8 (Windows-1258)', 'a.csv', Buffer.from([0x4d, 0xe3, 0x20, 0x53, 0x56])],
    ['đuôi lạ', 'a.exe', Buffer.from('x')],
    ['file rỗng', 'a.csv', Buffer.alloc(0)],
  ])('từ chối: %s', (_label, name, data) => {
    expect(() => sniffImportFile(name, data)).toThrow(FileRejectedError);
  });

  it('chống zip bomb: tính dung lượng sau giải nén từ mục lục ZIP', async () => {
    const zip = new JSZip();
    zip.file('xl/worksheets/sheet1.xml', 'a'.repeat(5_000_000));
    const data = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    expect(data.length).toBeLessThan(100_000);
    expect(zipUncompressedSize(data)).toBe(5_000_000);
  });
});
