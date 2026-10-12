import { z } from 'zod';

/** Form "Chạy đánh giá ngay": học kỳ + (chỉ DEMO_MODE) mốc asOf dạng YYYY-MM-DD. */
export const requestEvaluationSchema = z.object({
  termId: z.string().trim().min(1, 'Chọn học kỳ.').max(10),
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày mốc dạng YYYY-MM-DD.')
    .optional()
    .or(z.literal('')),
});
export type RequestEvaluationInput = z.infer<typeof requestEvaluationSchema>;
