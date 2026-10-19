import { z } from 'zod';
import { Severity } from '@/db/enums';
import { ALERT_STATUS_GROUPS } from '../services/alert-query.service';

/** Lọc thêm danh sách cảnh báo từ URL (`?severity=&status=&classId=`) — giá trị sai bị bỏ qua. */
export const alertExtraFilterSchema = z.object({
  severity: z.enum(Severity).optional().catch(undefined),
  status: z.enum(ALERT_STATUS_GROUPS).optional().catch(undefined),
  classId: z.string().trim().max(20).optional().catch(undefined),
});
