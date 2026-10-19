'use server';

import { EvaluationTrigger, UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { AppError, type ActionResult } from '@/lib/errors';
import {
  listTermMissingResults,
  type MissingResultDto,
  requestEvaluation,
  requestTermClosing,
} from '../services/evaluation-run.service';
import { closeTermSchema, requestEvaluationSchema, termOnlySchema } from '../validators/evaluation';
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

/** Hộp thoại "Chốt học kỳ": sinh viên còn học phần chưa có kết quả (docs/rules/08). */
export async function termMissingResultsAction(
  raw: unknown,
): Promise<ActionResult<MissingResultDto[]>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN],
    schema: termOnlySchema,
    run: ({ termId }) => listTermMissingResults(termId),
  });
}

/**
 * Chốt học kỳ = lần chạy đánh giá cuối `TERM_CLOSING`; chạy xong hệ thống đặt `closedAt`.
 * Mốc trong quá khứ chỉ khi DEMO_MODE (`resolveAsOf`). Audit Log ghi trong service.
 */
export async function requestTermClosingAction(
  raw: unknown,
): Promise<ActionResult<{ runId: string }>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN],
    schema: closeTermSchema,
    revalidate: ['/'],
    run: async (input, user) => ({
      runId: await requestTermClosing({
        termId: input.termId,
        asOf: resolveAsOf(input.asOfDate || undefined),
        actorId: user.userId,
      }),
    }),
  });
}
