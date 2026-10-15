import { z } from 'zod';

const optionalAdvisor = z
  .string()
  .trim()
  .max(20)
  .transform((v) => (v === '' ? null : v))
  .nullable();

/** Lớp sinh hoạt (docs/rules/09). Mã lớp chữ in hoa + số, VD KTPM2311. */
export const createClassSchema = z.object({
  classId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,20}$/, 'Mã lớp gồm 2–20 chữ in hoa hoặc số, VD KTPM2311'),
  className: z.string().trim().min(2, 'Nhập tên lớp').max(100, 'Tên lớp tối đa 100 ký tự'),
  departmentId: z.string().trim().min(1, 'Chọn khoa').max(10),
  cohortYear: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Khóa tuyển sinh là năm 4 chữ số, VD 2023'),
  advisorId: optionalAdvisor,
});
export type CreateClassInput = z.input<typeof createClassSchema>;
export type CreateClass = z.output<typeof createClassSchema>;

export const updateClassSchema = createClassSchema.omit({ advisorId: true });
export type UpdateClassInput = z.input<typeof updateClassSchema>;
export type UpdateClass = z.output<typeof updateClassSchema>;

export const changeAdvisorSchema = z.object({
  classId: z.string().trim().min(1).max(20),
  advisorId: optionalAdvisor,
});
export type ChangeAdvisor = z.output<typeof changeAdvisorSchema>;
