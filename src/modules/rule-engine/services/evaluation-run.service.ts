import { randomUUID } from 'node:crypto';
import { In, IsNull, type EntityManager } from 'typeorm';
import { z } from 'zod';
import { getDataSource } from '@/db/data-source';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { type EvaluationDataWarning, EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { Notification } from '@/db/entities/notification.entity';
import { RiskScoreLog } from '@/db/entities/risk-score-log.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { Term } from '@/db/entities/term.entity';
import {
  DataCompletenessLevel,
  DataStatus,
  EnrollmentStatus,
  EvaluationRunStatus,
  EvaluationTrigger,
  ImportBatchStatus,
  NotificationChannel,
  NotificationStatus,
} from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  invalidateAlertsAfterRollback,
  syncAlertsForChunk,
} from '@/modules/alerts/services/alert-sync.service';
import { createNotificationsForEvents } from '@/modules/alerts/services/notification.service';
import {
  enqueueNotificationEmails,
  type NotificationEnqueuer,
} from '@/modules/alerts/services/notification-queue';
import { evaluateStudent, type StudentEvaluation } from '../evaluator/engine';
import {
  findPreviousTerm,
  listTermStudents,
  loadLmsContexts,
  loadStudentInputs,
} from './evaluation-loader';
import { type EvaluationEnqueuer, enqueueEvaluationJob } from './evaluation-queue';
import { type ActiveRuleSet, loadActiveRuleSet } from './rule-config.service';

/** Lô sinh viên mỗi lần nạp/ghi (docs/rules/05). */
export const EVALUATION_CHUNK_SIZE = 200;
const MAX_WARNINGS = 500;

const snapshotSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
const componentsSchema = z.array(
  z.object({
    group: z.enum(['ATTENDANCE', 'LMS', 'ACADEMIC']),
    status: z.enum(DataStatus),
    weight: z.number(),
    rawValue: z.number().nullable(),
    normalized: z.number().min(0).max(1).nullable(),
    basis: z.enum(['CURRENT_TERM', 'PREVIOUS_TERM']).optional(),
  }),
);
const warningsSchema = z
  .array(
    z.object({
      code: z.string().max(40),
      studentId: z.string().max(20).optional(),
      courseId: z.string().max(20).optional(),
      message: z.string().max(500),
    }),
  )
  .max(MAX_WARNINGS);

export interface RequestEvaluationInput {
  termId: string;
  courseId: string | null;
  trigger: EvaluationTrigger;
  asOf: Date;
  actorId: string | null;
  importBatchId: string | null;
}

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';

/** Tạo EvaluationRun QUEUED trong transaction. Trả `null` khi đã có lần chạy chờ cùng phạm vi. */
async function insertRun(em: EntityManager, input: RequestEvaluationInput): Promise<string | null> {
  const term = await em.findOneBy(Term, { termId: input.termId });
  if (!term) throw new AppError('TERM_NOT_FOUND', 'Không tìm thấy học kỳ.');
  if (term.closedAt) {
    throw new AppError('TERM_CLOSED', `${term.termName} đã chốt, không chạy đánh giá được nữa.`);
  }
  if (
    input.courseId &&
    !(await em.existsBy(Enrollment, { termId: input.termId, courseId: input.courseId }))
  ) {
    throw new AppError('COURSE_NOT_IN_TERM', 'Học phần này chưa có dữ liệu trong học kỳ đã chọn.');
  }
  const busy = await em.find(EvaluationRun, {
    select: { id: true, status: true },
    where: {
      termId: input.termId,
      courseId: input.courseId ?? IsNull(),
      status: In([EvaluationRunStatus.QUEUED, EvaluationRunStatus.RUNNING]),
    },
  });
  // Tự động / theo lịch: đã có lần chờ thì lần đó sẽ đọc luôn dữ liệu mới. Thủ công / chốt học
  // kỳ: từ chối (docs/rules/11).
  const userRequested =
    input.trigger === EvaluationTrigger.MANUAL || input.trigger === EvaluationTrigger.TERM_CLOSING;
  if (!userRequested) {
    if (busy.some((r) => r.status === EvaluationRunStatus.QUEUED)) return null;
  } else if (busy.length > 0) {
    throw new AppError(
      'RUN_IN_PROGRESS',
      'Đang có lần chạy đánh giá cho phạm vi này — chờ xong rồi chạy lại.',
    );
  }
  const run = em.create(EvaluationRun, {
    termId: input.termId,
    courseId: input.courseId,
    trigger: input.trigger,
    asOf: input.asOf,
    triggeredBy: input.actorId,
    importBatchId: input.importBatchId,
    status: EvaluationRunStatus.QUEUED,
  });
  await em.insert(EvaluationRun, run);
  if (userRequested) {
    await writeAuditLog(
      {
        actorId: input.actorId,
        action:
          input.trigger === EvaluationTrigger.TERM_CLOSING
            ? 'TERM_CLOSE_REQUESTED'
            : 'EVALUATION_RUN_REQUESTED',
        targetType: 'EvaluationRun',
        targetId: run.id,
        detail: { termId: input.termId, courseId: input.courseId, asOf: input.asOf.toISOString() },
      },
      em,
    );
  }
  return run.id;
}

/**
 * Yêu cầu 1 lần chạy đánh giá (tự động sau nạp hoặc Admin bấm) — 2 đường dùng chung 1 job.
 * Trả `null` khi lần chạy tự động gộp vào lần đang chờ.
 */
export async function requestEvaluation(
  input: RequestEvaluationInput,
  enqueue: EvaluationEnqueuer = enqueueEvaluationJob,
): Promise<string | null> {
  const dataSource = await getDataSource();
  let runId: string | null;
  try {
    runId = await dataSource.transaction((em) => insertRun(em, input));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    if (
      input.trigger === EvaluationTrigger.MANUAL ||
      input.trigger === EvaluationTrigger.TERM_CLOSING
    ) {
      throw new AppError('RUN_IN_PROGRESS', 'Đang có lần chạy đánh giá cho phạm vi này.');
    }
    return null;
  }
  if (runId) await enqueue(runId);
  return runId;
}

/**
 * Sau khi lô dữ liệu học tập đạt RECONCILED (hoặc được hoàn tác): đánh giá lại học kỳ của lô
 * với asOf = bây giờ (docs/rules/08, 12). Học kỳ đã chốt → bỏ qua.
 */
export async function requestAutoEvaluation(
  batch: { id: string; termId: string | null },
  enqueue: EvaluationEnqueuer = enqueueEvaluationJob,
): Promise<string | null> {
  if (!batch.termId) return null;
  try {
    return await requestEvaluation(
      {
        termId: batch.termId,
        courseId: null,
        trigger: EvaluationTrigger.AUTO_AFTER_IMPORT,
        asOf: new Date(),
        actorId: null,
        importBatchId: batch.id,
      },
      enqueue,
    );
  } catch (error) {
    if (error instanceof AppError && error.code === 'TERM_CLOSED') return null;
    throw error;
  }
}

/**
 * Lịch mỗi đêm (docs/rules/05): chạy cả học kỳ hiện tại với asOf = bây giờ — bắt bài LMS mới đến
 * hạn và điểm danh quá hạn khi không có file mới. Không có học kỳ hiện tại / đã chốt → bỏ qua.
 */
export async function requestScheduledEvaluation(
  enqueue: EvaluationEnqueuer = enqueueEvaluationJob,
): Promise<string | null> {
  const term = await (await getDataSource()).getRepository(Term).findOneBy({ isCurrent: true });
  if (!term || term.closedAt) return null;
  return requestEvaluation(
    {
      termId: term.termId,
      courseId: null,
      trigger: EvaluationTrigger.SCHEDULED,
      asOf: new Date(),
      actorId: null,
      importBatchId: null,
    },
    enqueue,
  );
}

/** Sinh viên còn học phần chưa có kết quả trong học kỳ — hộp thoại "Chốt học kỳ" (docs/rules/08). */
export interface MissingResultDto {
  studentId: string;
  fullName: string;
  classId: string;
  courses: { courseId: string; courseName: string }[];
}

export async function listTermMissingResults(termId: string): Promise<MissingResultDto[]> {
  const rows: {
    student_id: string;
    full_name: string;
    class_id: string;
    course_id: string;
    course_name: string;
  }[] = await (
    await getDataSource()
  ).query(
    `SELECT s.student_id, s.full_name, s.class_id, c.course_id, c.course_name
       FROM enrollments e
       JOIN students s ON s.student_id = e.student_id
       JOIN courses c ON c.course_id = e.course_id
      WHERE e.term_id = $1 AND e.enrollment_status <> $2
        AND NOT EXISTS (SELECT 1 FROM course_results r WHERE r.enrollment_id = e.enrollment_id)
      ORDER BY s.student_id, c.course_id`,
    [termId, EnrollmentStatus.WITHDRAWN],
  );
  const byStudent = new Map<string, MissingResultDto>();
  for (const r of rows) {
    const item = byStudent.get(r.student_id) ?? {
      studentId: r.student_id,
      fullName: r.full_name,
      classId: r.class_id,
      courses: [],
    };
    item.courses.push({ courseId: r.course_id, courseName: r.course_name });
    byStudent.set(r.student_id, item);
  }
  return [...byStudent.values()];
}

/**
 * Chốt học kỳ (docs/rules/08, chốt 2026-10-18): tạo lần chạy cuối `TERM_CLOSING` cho cả học kỳ —
 * ACA-02/03/04 tính trên học phần đã có kết quả; chạy xong thì đặt `Term.closedAt`.
 */
export async function requestTermClosing(
  input: { termId: string; asOf: Date; actorId: string },
  enqueue: EvaluationEnqueuer = enqueueEvaluationJob,
): Promise<string> {
  const runId = await requestEvaluation(
    {
      termId: input.termId,
      courseId: null,
      trigger: EvaluationTrigger.TERM_CLOSING,
      asOf: input.asOf,
      actorId: input.actorId,
      importBatchId: null,
    },
    enqueue,
  );
  if (!runId) throw new AppError('RUN_IN_PROGRESS', 'Đang có lần chạy đánh giá cho học kỳ này.');
  return runId;
}

/**
 * Sau khi lô dữ liệu học tập nạp xong (RECONCILED). `DEMO_MODE=true`: KHÔNG tự chạy — dữ liệu demo
 * có ngày cố định, Admin chạy với mốc demo để kết quả khớp KET_QUA_MONG_DOI (người dùng chốt
 * 2026-10-15). Chạy lại sau hoàn tác lô vẫn tự chạy (`requestAutoEvaluation`).
 */
export async function requestEvaluationAfterImport(
  batch: { id: string; termId: string | null },
  enqueue: EvaluationEnqueuer = enqueueEvaluationJob,
): Promise<string | null> {
  if (getEnv().DEMO_MODE) return null;
  return requestAutoEvaluation(batch, enqueue);
}

/** Khóa theo phạm vi (học kỳ, học phần): 2 lần chạy cùng phạm vi chạy lần lượt. */
async function withScopeLock<T>(run: EvaluationRun, work: () => Promise<T>): Promise<T> {
  const runner = (await getDataSource()).createQueryRunner();
  const key = `evaluation:${run.termId}:${run.courseId ?? '-'}`;
  await runner.connect();
  try {
    await runner.query('SELECT pg_advisory_lock(hashtext($1))', [key]);
    return await work();
  } finally {
    await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [key]).catch(() => undefined);
    await runner.release();
  }
}

/** Ghi kết quả 1 lô sinh viên (trigger + RiskScore) trong 1 transaction. */
async function persistChunk(
  em: EntityManager,
  run: EvaluationRun,
  ruleSet: ActiveRuleSet,
  results: StudentEvaluation[],
  rollback: boolean,
): Promise<{ created: number; updated: number }> {
  const now = new Date();
  const logIds = new Map(results.map((r) => [r.studentId, randomUUID()]));
  // Id trigger sinh trước: cảnh báo lưu "dấu hiệu hiện tại" theo id (docs/rules/08).
  const withIds = results.map((r) => ({
    ...r,
    triggers: r.triggers.map((t) => ({ ...t, id: randomUUID() })),
  }));
  if (results.length > 0) {
    await em.insert(
      RiskScoreLog,
      results.map((r) => ({
        id: logIds.get(r.studentId),
        studentId: r.studentId,
        termId: run.termId,
        riskScoreValue: r.riskScore.value,
        dataCompletenessLevel: r.riskScore.level,
        componentsUsed: componentsSchema.parse(r.riskScore.components),
        ruleVersionId: ruleSet.configVersionId,
        evaluationRunId: run.id,
        calculatedAt: now,
      })),
    );
  }
  // Bước 7–9: gộp dấu hiệu vào cảnh báo (1 / sinh viên / học kỳ) rồi gắn trigger vào cảnh báo.
  const sync = await syncAlertsForChunk(
    em,
    { id: run.id, termId: run.termId, asOf: run.asOf, courseId: run.courseId, rollback },
    withIds.map((r) => ({
      studentId: r.studentId,
      riskScoreLogId: logIds.get(r.studentId) ?? null,
      signals: r.triggers.map((t) => ({
        ruleCode: t.ruleCode,
        scopeId: t.scopeId,
        severity: t.severity,
        triggerId: t.id,
      })),
      staleScopes: r.staleScopes,
    })),
  );
  const triggers = withIds.flatMap((r) =>
    r.triggers.map((t) => ({
      id: t.id,
      alertId: sync.alertIdByStudent.get(r.studentId) ?? null,
      evaluationRunId: run.id,
      ruleCode: t.ruleCode,
      ruleVersionId: t.ruleVersionId,
      studentId: r.studentId,
      scopeId: t.scopeId,
      termId: run.termId,
      triggeredAt: now,
      inputSnapshot: snapshotSchema.parse(t.inputSnapshot),
      reason: t.reason,
      severity: t.severity,
    })),
  );
  if (triggers.length > 0) await em.insert(RuleTrigger, triggers);
  // Bước 10: thông báo — tạo trong cùng transaction, gửi email sau khi lần chạy xong.
  await createNotificationsForEvents(em, sync.events, run.id);
  return { created: sync.created, updated: sync.updated };
}

/** Chạy toàn bộ: lô 200 sinh viên, cập nhật tiến độ sau mỗi lô. */
async function executeRun(run: EvaluationRun): Promise<void> {
  const dataSource = await getDataSource();
  const em = dataSource.manager;
  await em.delete(RuleTrigger, { evaluationRunId: run.id });
  await em.delete(RiskScoreLog, { evaluationRunId: run.id });
  const ruleSet = await loadActiveRuleSet(em);
  const term = await em.findOneByOrFail(Term, { termId: run.termId });
  const previousTerm = await findPreviousTerm(em, term);
  const students = await listTermStudents(em, run.termId, run.courseId);
  await em.update(EvaluationRun, { id: run.id }, { totalStudents: students.length });
  const lms = await loadLmsContexts(em, run.termId, run.asOf, ruleSet.config.lms);
  const context = {
    ...ruleSet,
    asOf: run.asOf,
    courseId: run.courseId,
    termClosing: run.trigger === EvaluationTrigger.TERM_CLOSING,
  };
  const rollback = await isRollbackRun(run);

  const warnings: EvaluationDataWarning[] = [];
  let insufficient = 0;
  let alertsCreated = 0;
  let alertsUpdated = 0;
  for (let i = 0; i < students.length; i += EVALUATION_CHUNK_SIZE) {
    const ids = students.slice(i, i + EVALUATION_CHUNK_SIZE);
    const inputs = await loadStudentInputs(em, { term, previousTerm }, ids, run.asOf, lms);
    const results = inputs.map((input) => evaluateStudent(input, context));
    for (const r of results) {
      if (r.riskScore.level === DataCompletenessLevel.INSUFFICIENT) insufficient += 1;
      for (const w of r.warnings) {
        if (warnings.length < MAX_WARNINGS) warnings.push({ ...w, studentId: r.studentId });
      }
    }
    await dataSource.transaction(async (tx) => {
      const counts = await persistChunk(tx, run, ruleSet, results, rollback);
      alertsCreated += counts.created;
      alertsUpdated += counts.updated;
      await tx.update(EvaluationRun, { id: run.id }, { processedStudents: i + ids.length });
    });
  }
  if (rollback) {
    await dataSource.transaction((tx) => invalidateAlertsAfterRollback(tx, run));
  }
  await dataSource.transaction(async (tx) => {
    await tx.update(
      EvaluationRun,
      { id: run.id },
      {
        status: EvaluationRunStatus.COMPLETED,
        finishedAt: new Date(),
        insufficientCount: insufficient,
        alertsCreated,
        alertsUpdated,
        dataWarnings: warnings.length > 0 ? warningsSchema.parse(warnings) : null,
      },
    );
    if (run.trigger === EvaluationTrigger.TERM_CLOSING) await closeTermAfterFinalRun(tx, run);
  });
}

/** Lần chạy chốt học kỳ xong → đặt `Term.closedAt` (docs/rules/08, chốt 2026-10-18). */
async function closeTermAfterFinalRun(em: EntityManager, run: EvaluationRun): Promise<void> {
  await em.update(Term, { termId: run.termId, closedAt: IsNull() }, { closedAt: new Date() });
  await writeAuditLog(
    {
      actorId: run.triggeredBy,
      action: 'TERM_CLOSED',
      targetType: 'Term',
      targetId: run.termId,
      detail: { evaluationRunId: run.id, asOf: run.asOf.toISOString() },
    },
    em,
  );
}

/** Lần chạy lại sau khi hoàn tác lô (docs/rules/12) — được phép đánh dấu cảnh báo không còn hiệu lực. */
async function isRollbackRun(run: EvaluationRun): Promise<boolean> {
  if (!run.importBatchId) return false;
  const batch = await (
    await getDataSource()
  )
    .getRepository(ImportBatch)
    .findOneBy({ id: run.importBatchId });
  return batch?.status === ImportBatchStatus.ROLLED_BACK;
}

/** Email còn chờ của lần chạy → hàng đợi (jobId = id thông báo nên gửi lại không trùng). */
async function enqueuePendingEmails(runId: string, notify: NotificationEnqueuer): Promise<void> {
  const pending = await (await getDataSource()).getRepository(Notification).find({
    select: { notificationId: true },
    where: {
      evaluationRunId: runId,
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.QUEUED,
    },
  });
  await notify(pending.map((n) => n.notificationId));
}

/**
 * Job `evaluation-run`: idempotent — chạy lại (retry) xóa trigger/RiskScore cũ của CHÍNH lần chạy rồi
 * tính lại; cảnh báo không bị tạo trùng (unique theo sinh viên × học kỳ), email không gửi trùng
 * (jobId = id thông báo). Không ghi `Student.officialAcademicStatus` (docs/rules/00).
 */
export async function processEvaluationRun(
  runId: string,
  notify: NotificationEnqueuer = enqueueNotificationEmails,
): Promise<void> {
  const repo = (await getDataSource()).getRepository(EvaluationRun);
  const initial = await repo.findOneBy({ id: runId });
  if (!initial) return;
  if (initial.status === EvaluationRunStatus.COMPLETED) return enqueuePendingEmails(runId, notify);
  await withScopeLock(initial, async () => {
    const run = await repo.findOneByOrFail({ id: runId });
    if (run.status === EvaluationRunStatus.COMPLETED) return;
    await repo.update(runId, {
      status: EvaluationRunStatus.RUNNING,
      startedAt: new Date(),
      processedStudents: 0,
      errorMessage: null,
    });
    await executeRun(run);
  });
  await enqueuePendingEmails(runId, notify);
}

/** Job lỗi hết số lần thử → FAILED kèm lý do, không treo "đang chạy" mãi. */
export async function failEvaluationRun(runId: string, reason: string): Promise<void> {
  logger.error({ runId, reason }, 'lần chạy đánh giá lỗi');
  const repo = (await getDataSource()).getRepository(EvaluationRun);
  await repo.update(
    { id: runId, status: In([EvaluationRunStatus.QUEUED, EvaluationRunStatus.RUNNING]) },
    {
      status: EvaluationRunStatus.FAILED,
      errorMessage: 'Lỗi hệ thống khi chạy đánh giá. Vui lòng chạy lại.',
      finishedAt: new Date(),
    },
  );
}
