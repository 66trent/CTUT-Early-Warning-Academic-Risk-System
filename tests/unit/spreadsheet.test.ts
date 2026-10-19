import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { BOM, neutralizeFormula, toCsv, toXlsx } from '@/lib/spreadsheet';

describe('Xuất file — chống chèn công thức (docs/rules/06)', () => {
  it('ô bắt đầu bằng = + - @ tab CR được thêm tiền tố nháy đơn', () => {
    for (const v of ['=1+1', '+SUM(A1)', '-2', '@cmd', '\tx', '\rx']) {
      expect(neutralizeFormula(v)).toBe(`'${v}`);
    }
    expect(neutralizeFormula('Nguyễn Văn A')).toBe('Nguyễn Văn A');
  });

  it('CSV có BOM, bọc ngoặc kép ô có dấu phẩy, số giữ nguyên', () => {
    const csv = toCsv(
      ['A', 'B'],
      [
        { A: '=1+1', B: 2 },
        { A: 'x, "y"', B: 3 },
      ],
    );
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual(['A,B', "'=1+1,2", '"x, ""y""",3']);
  });

  it('XLSX: tiêu đề + dòng dữ liệu, ô công thức thành văn bản', async () => {
    const buffer = await toXlsx(
      'Thử',
      ['MSSV', 'Ghi chú', 'Số'],
      [{ MSSV: 'SV001', 'Ghi chú': '=HYPERLINK("x")', Số: 5 }],
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const sheet = wb.getWorksheet('Thử');
    expect(sheet?.getRow(1).values).toEqual([undefined, 'MSSV', 'Ghi chú', 'Số']);
    expect(sheet?.getRow(2).getCell(2).value).toBe(`'=HYPERLINK("x")`);
    expect(sheet?.getRow(2).getCell(3).value).toBe(5);
  });
});
