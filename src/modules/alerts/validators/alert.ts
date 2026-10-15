import { z } from 'zod';
import {
  AlertStatus,
  ConfidentialityLevel,
  INTERVENTION_STATUSES,
  InterventionType,
} from '@/db/enums';

export const alertIdSchema = z.object({ alertId: z.uuid() });
export const triggerIdSchema = z.object({ triggerId: z.uuid() });
export const termIdSchema = z.object({ termId: z.string().trim().min(1).max(10) });

export const changeAlertStatusSchema = z.object({
  alertId: z.uuid(),
  toStatus: z.enum(AlertStatus),
  reason: z.string().trim().max(1000).optional(),
});

/** Form ghi can thiệp (docs/rules/11) — nội dung nhập tự do, hiển thị không dùng HTML thô. */
export const interventionSchema = z
  .object({
    alertId: z.uuid(),
    type: z.enum(InterventionType),
    content: z.string().trim().min(5, 'Mô tả can thiệp ít nhất 5 ký tự.').max(4000),
    outcome: z.string().trim().max(2000).optional().or(z.literal('')),
    status: z.enum(INTERVENTION_STATUSES),
    nextFollowUpAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày hẹn theo dõi dạng YYYY-MM-DD.')
      .optional()
      .or(z.literal('')),
    confidentialityLevel: z.enum(ConfidentialityLevel),
  })
  .refine((v) => v.status !== 'FOLLOW_UP' || Boolean(v.nextFollowUpAt), {
    message: 'Cần theo dõi tiếp thì chọn ngày hẹn theo dõi.',
    path: ['nextFollowUpAt'],
  });
export type InterventionForm = z.infer<typeof interventionSchema>;
