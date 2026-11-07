import { z } from 'zod';

const termId = z.string().trim().min(1, 'Chọn học kỳ.').max(10);

export const moodleLinkSchema = z.object({
  termId,
  moodleCourseId: z.number().int().positive(),
  enabled: z.boolean(),
  courseId: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z]{3,20}$/, 'Mã học phần 3–20 ký tự chữ/số.')
    .optional(),
  courseName: z.string().trim().min(1, 'Nhập tên học phần.').max(150).optional(),
  totalPeriodsOverride: z.number().int().min(1).max(500).nullable().optional(),
});

export const moodleSyncRequestSchema = z.object({ termId });
export const moodleSyncRunSchema = z.object({ runId: z.uuid() });
