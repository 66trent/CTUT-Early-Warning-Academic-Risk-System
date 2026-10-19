import { z } from 'zod';
import {
  type ImportBatchSummary,
  type ImportCourseCard,
  type ImportWarning,
} from '@/db/entities/import-batch.entity';

/** Thẻ nhận diện học phần ở màn xem trước (docs/rules/12). */
const courseCardSchema: z.ZodType<ImportCourseCard> = z.object({
  courseId: z.string().max(20),
  courseName: z.string().max(150),
  derivedCode: z.boolean(),
  isNew: z.boolean(),
  sectionCodes: z.array(z.string().max(30)).max(50),
  validRows: z.number().int().min(0),
  errorRows: z.number().int().min(0),
  warningRows: z.number().int().min(0),
  studentCount: z.number().int().min(0),
  classes: z
    .array(z.object({ classId: z.string(), departmentId: z.string(), count: z.number().int() }))
    .max(200),
  totalPeriods: z.number().int().nullable().optional(),
  snapshotDates: z.array(z.string()).max(50).optional(),
  previousSnapshotDate: z.string().nullable().optional(),
  activities: z
    .array(z.object({ key: z.string(), name: z.string(), dueAt: z.string().nullable() }))
    .max(200)
    .optional(),
  credits: z.number().int().nullable().optional(),
  publishedDates: z.array(z.string()).max(50).optional(),
});

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
  courses: z.array(courseCardSchema).max(200).optional(),
});

export type ImportSummary = ImportBatchSummary;

export function readSummary(value: unknown): ImportSummary {
  const parsed = importSummarySchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function writeSummary(summary: ImportSummary): ImportBatchSummary {
  return importSummarySchema.parse(summary);
}

/** Tối đa số cảnh báo lưu cho 1 lô (docs/rules/12). */
export const MAX_WARNINGS = 500;

/** Cột jsonb `ImportBatch.warnings` — validate bằng Zod trước khi ghi (docs/rules/01). */
export const importWarningsSchema: z.ZodType<ImportWarning[]> = z
  .array(
    z.object({
      row: z.number().int().min(1),
      code: z.string().max(40),
      message: z.string().max(255),
    }),
  )
  .max(MAX_WARNINGS);

export function writeWarnings(warnings: ImportWarning[]): ImportWarning[] | null {
  return warnings.length === 0
    ? null
    : importWarningsSchema.parse(warnings.map((w) => ({ ...w, message: w.message.slice(0, 255) })));
}

export function readWarnings(value: unknown): ImportWarning[] {
  const parsed = importWarningsSchema.safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}

/** Ngưỡng tỷ lệ lỗi cảnh báo ở màn xem trước (docs/rules/12). */
export const HIGH_ERROR_RATE = 0.1;
