'use server';

import { EvaluationTrigger, UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { vnEndOfDay, vnStartOfDay } from '@/lib/dates';
import { getEnv } from '@/lib/env';
import { AppError, type ActionResult } from '@/lib/errors';
import { requestEvaluation } from '../services/evaluation-run.service';
import { requestEvaluationSchema } from '../validators/evaluation';

/**
 * Admin bấm "Chạy đánh giá ngay". Mốc asOf trong quá khứ CHỈ khi DEMO_MODE=true — kiểm tra ở
 * server (docs/rules/06); ngoài ra asOf = bây giờ. Audit Log ghi trong service.
 */
export async function requestEvaluationAction(
  raw: unknown,
): Promise<ActionResult<{ runId: string }>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN],
    schema: requestEvaluationSchema,
    revalidate: ['/admin/evaluations'],
    run: async (input, user) => {
      let asOf = new Date();
      if (input.asOfDate) {
        if (!getEnv().DEMO_MODE) {
          throw new AppError(
            'FORBIDDEN',
            'Chỉ chế độ demo mới chọn được mốc dữ liệu trong quá khứ.',
          );
        }
        if (vnStartOfDay(input.asOfDate) > asOf) {
          throw new AppError('INVALID_INPUT', 'Mốc dữ liệu không được ở tương lai.');
        }
        // Hết ngày đã chọn, nhưng không vượt quá bây giờ (chọn hôm nay = đến thời điểm hiện tại).
        const endOfDay = vnEndOfDay(input.asOfDate);
        if (endOfDay < asOf) asOf = endOfDay;
      }
      const runId = await requestEvaluation({
        termId: input.termId,
        courseId: null,
        trigger: EvaluationTrigger.MANUAL,
        asOf,
        actorId: user.userId,
        importBatchId: null,
      });
      if (!runId) throw new AppError('RUN_IN_PROGRESS', 'Đang có lần chạy cho học kỳ này.');
      return { runId };
    },
  });
}
