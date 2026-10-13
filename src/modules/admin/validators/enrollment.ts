import { z } from 'zod';

export const setWithdrawnSchema = z.object({
  studentId: z.string().trim().min(1).max(20),
  enrollmentId: z.uuid('Học phần không hợp lệ.'),
  withdrawn: z.boolean(),
});
