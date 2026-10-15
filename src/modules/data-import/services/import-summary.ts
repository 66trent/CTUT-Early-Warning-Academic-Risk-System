import { z } from 'zod';
import { type ImportBatchSummary } from '@/db/entities/import-batch.entity';

/** Cấu trúc cột jsonb `ImportBatch.summary` — validate bằng Zod trước khi ghi (docs/rules/01). */
export const importSummarySchema: z.ZodType<ImportBatchSummary> = z.object({
  /** Header gốc theo thứ tự trong file — jsonb sắp lại khóa nên phải lưu riêng. */
  columns: z.array(z.string()).max(200).optional(),
  /** Vài dòng hợp lệ đầu tiên (theo header gốc) cho màn xem trước. */
  preview: z.array(z.record(z.string(), z.string())).max(5).optional(),
  errorRate: z.number().min(0).max(1).optional(),
  confirmedAt: z.string().optional(),
  confirmedBy: z.string().max(20).optional(),
  /** Job nạp phải chạy lại (lỗi giữa chừng) → không hoàn tác được vì số liệu tạo mới không chắc chắn. */
  retried: z.boolean().optional(),
  inserted: z.number().int().min(0).optional(),
  updated: z.number().int().min(0).optional(),
  unchanged: z.number().int().min(0).optional(),
  createdKeys: z.array(z.string()).optional(),
});

export type ImportSummary = ImportBatchSummary;

export function readSummary(value: unknown): ImportSummary {
  const parsed = importSummarySchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function writeSummary(summary: ImportSummary): ImportBatchSummary {
  return importSummarySchema.parse(summary);
}

/** Ngưỡng tỷ lệ lỗi cảnh báo ở màn xem trước (docs/rules/12). */
export const HIGH_ERROR_RATE = 0.1;
