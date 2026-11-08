import { getDataSource } from '@/db/data-source';
import { ImportBatchFile } from '@/db/entities/import-batch-file.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { BOM, csvCell, neutralizeFormula } from '@/lib/spreadsheet';
import { errorReasonLabel } from '../labels';

export { neutralizeFormula };

/**
 * File dòng lỗi để tải về sửa (docs/rules/12): UTF-8 có BOM, cột `dong`, `ly_do`, `ma_loi`
 * (lô nhiều file thêm `ten_file`) rồi các cột gốc của file — sửa xong xóa các cột đầu (hoặc giữ,
 * cột thừa được bỏ qua) và nạp lại.
 */
export async function buildErrorCsv(batchId: string): Promise<string> {
  const ds = await getDataSource();
  const [rows, batch, files] = await Promise.all([
    ds.getRepository(ImportErrorRow).find({
      select: {
        sourceRowNumber: true,
        sourceFileName: true,
        errorReason: true,
        errorDetail: true,
        rawData: true,
      },
      where: { importBatchId: batchId },
      order: { sourceRowNumber: 'ASC' },
    }),
    ds.getRepository(ImportBatch).findOne({
      select: { id: true, summary: true },
      where: { id: batchId },
    }),
    ds.getRepository(ImportBatchFile).find({
      select: { fileName: true, fileOrder: true },
      where: { importBatchId: batchId },
    }),
  ]);
  const fileOrder = new Map(files.map((f) => [f.fileName, f.fileOrder]));
  const orderOf = (row: ImportErrorRow) =>
    row.sourceFileName ? (fileOrder.get(row.sourceFileName) ?? 0) : 0;
  rows.sort((a, b) => orderOf(a) - orderOf(b) || a.sourceRowNumber - b.sourceRowNumber);
  const multi = files.length > 1;
  // Giữ đúng thứ tự cột của file gốc (jsonb không giữ thứ tự khóa).
  const originalHeaders = [
    ...new Set([
      ...(batch?.summary?.columns ?? []),
      ...rows.flatMap((r) => Object.keys(r.rawData)),
    ]),
  ];
  const lead = ['dong', 'ly_do', 'ma_loi', ...(multi ? ['ten_file'] : [])];
  const lines = [[...lead, ...originalHeaders].map(csvCell).join(',')];
  for (const row of rows) {
    const reason = row.errorDetail
      ? `${errorReasonLabel(row.errorReason)}: ${row.errorDetail}`
      : errorReasonLabel(row.errorReason);
    lines.push(
      [
        String(row.sourceRowNumber),
        reason,
        row.errorReason,
        ...(multi ? [row.sourceFileName ?? ''] : []),
        ...originalHeaders.map((h) => row.rawData[h] ?? ''),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}
