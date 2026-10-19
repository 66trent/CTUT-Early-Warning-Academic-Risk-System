import { getDataSource } from '@/db/data-source';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { BOM, csvCell, neutralizeFormula } from '@/lib/spreadsheet';
import { errorReasonLabel } from '../labels';

export { neutralizeFormula };

/**
 * File dòng lỗi để tải về sửa (docs/rules/12): UTF-8 có BOM, cột `dong`, `ly_do`, `ma_loi`
 * rồi các cột gốc của file — sửa xong xóa 3 cột đầu (hoặc giữ, cột thừa được bỏ qua) và nạp lại.
 */
export async function buildErrorCsv(batchId: string): Promise<string> {
  const rows = await (await getDataSource()).getRepository(ImportErrorRow).find({
    select: { sourceRowNumber: true, errorReason: true, errorDetail: true, rawData: true },
    where: { importBatchId: batchId },
    order: { sourceRowNumber: 'ASC' },
  });
  const batch = await (await getDataSource()).getRepository(ImportBatch).findOne({
    select: { id: true, summary: true },
    where: { id: batchId },
  });
  // Giữ đúng thứ tự cột của file gốc (jsonb không giữ thứ tự khóa).
  const originalHeaders = [
    ...new Set([
      ...(batch?.summary?.columns ?? []),
      ...rows.flatMap((r) => Object.keys(r.rawData)),
    ]),
  ];
  const lines = [['dong', 'ly_do', 'ma_loi', ...originalHeaders].map(csvCell).join(',')];
  for (const row of rows) {
    const reason = row.errorDetail
      ? `${errorReasonLabel(row.errorReason)}: ${row.errorDetail}`
      : errorReasonLabel(row.errorReason);
    lines.push(
      [
        String(row.sourceRowNumber),
        reason,
        row.errorReason,
        ...originalHeaders.map((h) => row.rawData[h] ?? ''),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}
