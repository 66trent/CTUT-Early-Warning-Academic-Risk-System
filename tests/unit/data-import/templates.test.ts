import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildHeaderMap } from '@/modules/data-import/parsing/headers';
import { openRowSource } from '@/modules/data-import/parsing/row-reader';
import { availableImportTypes, getImportDefinition } from '@/modules/data-import/types/registry';

/** Đọc file mẫu và chuẩn hóa từng dòng bằng đúng định nghĩa loại nhập. */
async function parseTemplate(dataType: string, file: string) {
  const def = getImportDefinition(dataType);
  if (!def) throw new Error(dataType);
  const kind = file.endsWith('.xlsx') ? 'xlsx' : 'csv';
  const source = await openRowSource(kind, createReadStream(`public${file}`));
  const map = buildHeaderMap(source.headers);
  const values: unknown[] = [];
  for await (const row of source.rows) {
    const record = Object.fromEntries(
      [...map.index].map(([name, i]) => [name, row.values[i] ?? '']),
    );
    const parsed = def.parseRow(record, { decimalComma: source.decimalComma });
    expect(parsed, `${file} dòng ${row.rowNumber}`).toMatchObject({ ok: true });
    if (parsed.ok) values.push(parsed.value);
  }
  return values;
}

describe('File mẫu tải về — CSV (có BOM) và Excel cho cùng kết quả', () => {
  it.each(availableImportTypes().map((t) => [t.dataType, t.templatePath]))(
    '%s: mọi dòng hợp lệ, .xlsx khớp .csv (ngày không bị đổi kiểu Mỹ)',
    async (dataType, csvPath) => {
      const fromCsv = await parseTemplate(dataType, csvPath);
      const fromXlsx = await parseTemplate(dataType, csvPath.replace(/\.csv$/, '.xlsx'));
      expect(fromCsv.length).toBeGreaterThan(0);
      expect(fromXlsx).toEqual(fromCsv);
    },
  );
});
