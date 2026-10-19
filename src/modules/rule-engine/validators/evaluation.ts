import { z } from 'zod';

const asOfDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày mốc dạng YYYY-MM-DD.')
  .optional()
  .or(z.literal(''));

/** Form "Chạy đánh giá ngay": học kỳ, (tùy chọn) học phần, (chỉ DEMO_MODE) mốc asOf YYYY-MM-DD. */
export const requestEvaluationSchema = z.object({
  termId: z.string().trim().min(1, 'Chọn học kỳ.').max(10),
  courseId: z.string().trim().max(20).optional().or(z.literal('')),
  asOfDate,
});
export type RequestEvaluationInput = z.infer<typeof requestEvaluationSchema>;

export const termOnlySchema = z.object({
  termId: z.string().trim().min(1, 'Chọn học kỳ.').max(10),
});

/** Chốt học kỳ: (chỉ DEMO_MODE) mốc asOf của lần chạy cuối. */
export const closeTermSchema = z.object({
  termId: z.string().trim().min(1, 'Chọn học kỳ.').max(10),
  asOfDate,
});

/** Tạo phiên bản nháp — `condition` được kiểm tra bằng Zod của chính luật ở service. */
export const createRuleVersionSchema = z.object({
  ruleCode: z.string().trim().min(1).max(20),
  condition: z.unknown(),
});

export const ruleVersionIdSchema = z.object({ versionId: z.uuid('Phiên bản không hợp lệ.') });

export const dryRunSchema = z.object({
  versionId: z.uuid('Phiên bản không hợp lệ.'),
  termId: z.string().trim().min(1, 'Chọn học kỳ.').max(10),
  asOfDate,
});
