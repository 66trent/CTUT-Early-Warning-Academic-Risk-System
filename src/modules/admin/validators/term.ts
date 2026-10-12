import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Chọn ngày');

/**
 * Tạo học kỳ: chọn số học kỳ + năm bắt đầu năm học → tự sinh mã/tên/năm học (docs/rules/09).
 * VD: học kỳ 1, năm 2026 → `HK1_2026`, "Học kỳ 1, 2026–2027", năm học "2026-2027".
 */
export const createTermSchema = z
  .object({
    semester: z.number().int().min(1, 'Chọn học kỳ').max(3, 'Chọn học kỳ'),
    startYear: z
      .number({ message: 'Nhập năm' })
      .int()
      .min(2000, 'Năm không hợp lệ')
      .max(2100, 'Năm không hợp lệ'),
    startDate: isoDate,
    endDate: isoDate,
    setAsCurrent: z.boolean().default(false),
  })
  .refine((v) => v.endDate > v.startDate, {
    path: ['endDate'],
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
  });

export type CreateTermInput = z.input<typeof createTermSchema>;
export type CreateTerm = z.output<typeof createTermSchema>;

export const termIdSchema = z.string().regex(/^HK\d_\d{4}$/, 'Mã học kỳ không hợp lệ');

export function deriveTermIdentity(semester: number, startYear: number) {
  const academicYear = `${startYear}-${startYear + 1}`;
  return {
    termId: `HK${semester}_${startYear}`,
    termName: `Học kỳ ${semester}, ${startYear}–${startYear + 1}`,
    academicYear,
  };
}
