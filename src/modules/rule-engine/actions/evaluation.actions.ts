'use server';

import { EvaluationTrigger, UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { AppError, type ActionResult } from '@/lib/errors';
import { requestEvaluation } from '../services/evaluation-run.service';
import { requestEvaluationSchema } from '../validators/evaluation';
import { resolveAsOf } from './as-of';

/**
 * Admin bấm "Chạy đánh giá ngay" (cả học kỳ hoặc 1 học phần). Mốc asOf trong quá khứ CHỈ khi
 * DEMO_MODE=true (`resolveAsOf`). Audit Log ghi trong service.
 */
export async function requestEvaluationAction(
  raw: unknown,
): Promise<ActionResult<{ runId: string }>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN],
    schema: requestEvaluationSchema,
    revalidate: ['/admin/evaluations'],
    run: async (input, user) => {
      const runId = await requestEvaluation({
        termId: input.termId,
        courseId: input.courseId || null,
        trigger: EvaluationTrigger.MANUAL,
        asOf: resolveAsOf(input.asOfDate || undefined),
        actorId: user.userId,
        importBatchId: null,
      });
      if (!runId) throw new AppError('RUN_IN_PROGRESS', 'Đang có lần chạy cho học kỳ này.');
      return { runId };
    },
  });
}
