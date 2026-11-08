/**
 * Chế độ Tự động của đồng bộ Moodle (Phase 10c — docs/tich-hop-moodle.md 4a–4c, 9c):
 * sự kiện → gom 30 giây → kéo các khóa có sự kiện; lịch 10 phút dò dấu vân tay; mỗi đêm kéo đủ; job
 * hạn nộp. Lô tự xác nhận khi lỗi ≤ 10% (người dùng chốt), nạp xong tự đánh giá (kể cả DEMO_MODE).
 * Người thực hiện: tài khoản hệ thống `SYSTEM_MOODLE`.
 */
import { In, IsNull, LessThanOrEqual, MoreThan, Not } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { MoodleCourseLink } from '@/db/entities/moodle-course-link.entity';
import { MoodleEventInbox } from '@/db/entities/moodle-event-inbox.entity';
import { MoodleSyncRun } from '@/db/entities/moodle-sync-run.entity';
import {
  EvaluationTrigger,
  ImportBatchStatus,
  ImportSource,
  type MoodleSyncMode,
  type MoodleSyncTrigger,
} from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { type EvaluationEnqueuer } from '@/modules/rule-engine/services/evaluation-queue';
import { requestEvaluation } from '@/modules/rule-engine/services/evaluation-run.service';
import { type MoodleClient } from '../moodle/client';
import { courseFingerprint, fetchGradeItems, fetchMoodleCourseBase } from '../moodle/fetch-course';
import { type StudentResolver } from '../moodle/mappers';
import { confirmImportBatch } from './import-batch.service';
import { enqueueImportJob, type ImportEnqueuer } from './import-queue';
import { HIGH_ERROR_RATE, readSummary } from './import-summary';
import { describeMoodleError, getMoodleClientFromEnv } from './moodle-link.service';
import {
  enqueueMoodleFlush,
  EVENT_FLUSH_MS,
  type MoodleDueJob,
  type MoodleFlushEnqueuer,
} from './moodle-queue';
import {
  buildStudentResolver,
  createSyncRun,
  discardMoodleSync,
  ensureMoodleSystemUser,
  failInterruptedMoodleRuns,
  hasPendingRun,
  isSyncRunStale,
  type RunMoodleSyncDeps,
  runMoodleSync,
} from './moodle-sync.service';

export interface MoodleAutoDeps extends RunMoodleSyncDeps {
  /** Đánh giá sau khi lần đồng bộ không tạo lô (job hạn nộp, lịch đêm). */
  enqueueEvaluation?: EvaluationEnqueuer;
  /** Chỉ xét 1 học kỳ (test; mặc định mọi học kỳ chưa chốt có khóa Tự động). */
  termId?: string;
}

/** Khóa Tự động đang bật của các học kỳ chưa chốt. */
async function autoLinks(where: Partial<Pick<MoodleCourseLink, 'termId' | 'moodleCourseId'>> = {}) {
  const links = await (await getDataSource()).getRepository(MoodleCourseLink).find({
    where: { ...where, enabled: true, syncMode: 'AUTO' },
    relations: { term: true },
    order: { sectionCode: 'ASC' },
  });
  return links.filter((l) => !l.term?.closedAt);
}

// ── Sự kiện từ plugin local_ewars ───────────────────────────────────────────────────────

export interface MoodleEventInput {
  eventId: string;
  eventName: string;
  moodleCourseId: number;
  objectId: number | null;
  occurredAt: Date;
}

/**
 * Ghi nhận 1 sự kiện (đã kiểm HMAC ở route). Nhận trùng (`eventId` đã có) → `duplicate`. Khóa Tự
 * động → đánh dấu "có sự kiện" + đặt job gom 30 giây của học kỳ.
 */
export async function recordMoodleEvent(
  event: MoodleEventInput,
  now = new Date(),
  enqueueFlush: MoodleFlushEnqueuer = enqueueMoodleFlush,
): Promise<{ duplicate: boolean; queuedTerms: string[] }> {
  const dataSource = await getDataSource();
  const links = await autoLinks({ moodleCourseId: event.moodleCourseId });
  const inserted: unknown[] = await dataSource.query(
    `INSERT INTO moodle_event_inbox (event_id, event_name, moodle_course_id, object_id, occurred_at, outcome)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
    [
      event.eventId,
      event.eventName,
      event.moodleCourseId,
      event.objectId,
      event.occurredAt,
      links.length > 0 ? 'QUEUED' : 'IGNORED',
    ],
  );
  if (inserted.length === 0) return { duplicate: true, queuedTerms: [] };
  if (links.length === 0) return { duplicate: false, queuedTerms: [] };
  await dataSource
    .getRepository(MoodleCourseLink)
    .update({ id: In(links.map((l) => l.id)), pendingEventAt: IsNull() }, { pendingEventAt: now });
  const terms = [...new Set(links.map((l) => l.termId))];
  for (const termId of terms) await enqueueFlush(termId, now);
  return { duplicate: false, queuedTerms: terms };
}

async function startAutoRun(
  termId: string,
  trigger: MoodleSyncTrigger,
  linkIds: string[],
  deps: MoodleAutoDeps,
): Promise<MoodleSyncRun> {
  const requestedBy = await ensureMoodleSystemUser();
  const runId = await createSyncRun(
    { termId, trigger, mode: 'AUTO', requestedBy, linkIds },
    linkIds.length,
  );
  return runMoodleSync(runId, deps);
}

/** Job gom: kéo đủ các khóa Tự động của học kỳ có sự kiện chưa xử lý. */
export async function flushMoodleEvents(
  termId: string,
  deps: MoodleAutoDeps = {},
): Promise<MoodleSyncRun | null> {
  // Giờ thật (không phải mốc dữ liệu `deps.now`): sự kiện đến sau lúc này để lần gom sau.
  const now = new Date();
  const links = (await autoLinks({ termId })).filter(
    (l) => l.pendingEventAt && l.pendingEventAt <= now,
  );
  if (links.length === 0) return null;
  await (
    await getDataSource()
  )
    .getRepository(MoodleCourseLink)
    .update(
      { id: In(links.map((l) => l.id)), pendingEventAt: LessThanOrEqual(now) },
      { pendingEventAt: null },
    );
  return startAutoRun(
    termId,
    'EVENT',
    links.map((l) => l.id),
    deps,
  );
}

/** Đánh giá học kỳ (mốc = bây giờ) khi dữ liệu không đổi nhưng thời gian trôi (hạn nộp đã qua). */
async function evaluateTerm(termId: string, deps: MoodleAutoDeps): Promise<string | null> {
  return requestEvaluation(
    {
      termId,
      courseId: null,
      trigger: EvaluationTrigger.SCHEDULED,
      asOf: deps.now ?? new Date(),
      actorId: null,
      importBatchId: null,
    },
    deps.enqueueEvaluation,
  );
}

// ── Lịch 10 phút (dò dấu vân tay) + mỗi đêm ───────────────────────────────────────────

/** Dò 1 khóa: chỉ gọi phần rẻ + sổ điểm. Trả `true` khi khác lần kéo đủ gần nhất. */
async function probeCourse(
  link: MoodleCourseLink,
  client: MoodleClient,
  resolver: StudentResolver,
  now: Date,
): Promise<boolean> {
  const repo = (await getDataSource()).getRepository(MoodleCourseLink);
  try {
    const base = await fetchMoodleCourseBase(client, link.moodleCourseId);
    const grades = await fetchGradeItems(client, link.moodleCourseId);
    const resolved = base.students.flatMap((u) => resolver(u) ?? []);
    const fingerprint = courseFingerprint(base, grades, resolved);
    await repo.update({ id: link.id }, { lastCheckedAt: now });
    return fingerprint !== link.fingerprint;
  } catch (error) {
    const message = describeMoodleError(error);
    logger.warn({ linkId: link.id, err: message }, 'đồng bộ Moodle: lỗi dò thay đổi');
    await repo.update({ id: link.id }, { lastCheckedAt: now, lastError: message });
    return false;
  }
}

/** Lịch 10 phút: mỗi học kỳ, khóa nào đổi dấu vân tay → 1 lần đồng bộ `SCHEDULED`. */
export async function pollMoodleCourses(deps: MoodleAutoDeps = {}): Promise<MoodleSyncRun[]> {
  await failInterruptedMoodleRuns();
  await retryAutoConfirm(deps.enqueueImport);
  const links = await autoLinks(deps.termId ? { termId: deps.termId } : {});
  if (links.length === 0) return [];
  const now = deps.now ?? new Date();
  const client = deps.client ?? getMoodleClientFromEnv();
  const resolver = deps.resolver ?? (await buildStudentResolver());
  const changed = new Map<string, string[]>();
  // Sự kiện chờ quá lâu = job gom bị mất (VD Redis khởi động lại) → coi như có thay đổi.
  const lostEvent = (l: MoodleCourseLink) =>
    l.pendingEventAt !== null && Date.now() - l.pendingEventAt.getTime() > 4 * EVENT_FLUSH_MS;
  for (const link of links) {
    if (lostEvent(link) || (await probeCourse(link, client, resolver, now))) {
      changed.set(link.termId, [...(changed.get(link.termId) ?? []), link.id]);
    }
  }
  const runs: MoodleSyncRun[] = [];
  for (const [termId, linkIds] of changed) {
    runs.push(await startAutoRun(termId, 'SCHEDULED', linkIds, { ...deps, client, resolver }));
  }
  return runs;
}

/** Mỗi đêm: kéo đủ mọi khóa Tự động (vá sự kiện bị lỡ) rồi đánh giá học kỳ. */
export async function runNightlyMoodleSync(deps: MoodleAutoDeps = {}): Promise<MoodleSyncRun[]> {
  const byTerm = new Map<string, string[]>();
  for (const link of await autoLinks(deps.termId ? { termId: deps.termId } : {})) {
    byTerm.set(link.termId, [...(byTerm.get(link.termId) ?? []), link.id]);
  }
  const runs: MoodleSyncRun[] = [];
  for (const [termId, linkIds] of byTerm) {
    const run = await startAutoRun(termId, 'NIGHTLY', linkIds, deps);
    if (run.status !== 'STAGED') await evaluateTerm(termId, deps);
    runs.push(run);
  }
  return runs;
}

/**
 * Job hạn nộp (hạn + 5 phút): khóa vẫn Tự động và hạn vẫn đúng (giảng viên chưa đổi) → kéo lại khóa
 * (bắt bài nộp phút chót) → đánh giá. Không có gì mới để nạp vẫn đánh giá: "không nộp" đến từ thời
 * gian trôi, không từ dữ liệu (docs/tich-hop-moodle.md 4c).
 */
export async function runMoodleDueJob(
  job: MoodleDueJob,
  deps: MoodleAutoDeps = {},
): Promise<{ skipped: string } | { runId: string; evaluationRunId: string | null }> {
  const link = await (
    await getDataSource()
  )
    .getRepository(MoodleCourseLink)
    .findOne({ where: { id: job.linkId }, relations: { term: true } });
  if (!link || !link.enabled || link.syncMode !== 'AUTO' || link.term?.closedAt) {
    return { skipped: 'khóa không còn ở chế độ Tự động' };
  }
  const activity = link.seenActivities.find((a) => a.kind === job.kind && a.id === job.activityId);
  if (!activity?.dues?.includes(job.dueAt)) return { skipped: 'hạn nộp đã đổi' };
  const run = await startAutoRun(link.termId, 'DUE_DATE', [link.id], deps);
  const evaluationRunId = run.status === 'STAGED' ? null : await evaluateTerm(link.termId, deps);
  return { runId: run.id, evaluationRunId };
}

// ── Tự xác nhận ─────────────────────────────────────────────────────────────────────────

/**
 * Sau bước kiểm tra (lô `STAGED`): lô Moodle của lần đồng bộ Tự động, tỷ lệ lỗi ≤ 10% → hệ thống tự
 * xác nhận. > 10% → giữ chờ, trang Kết nối báo "Cần Admin xem" (người dùng chốt 2026-11-08).
 */
export async function autoConfirmMoodleBatch(
  batchId: string,
  enqueue: ImportEnqueuer = enqueueImportJob,
): Promise<'CONFIRMED' | 'NEEDS_REVIEW' | 'NOT_AUTO'> {
  const dataSource = await getDataSource();
  const batch = await dataSource.getRepository(ImportBatch).findOneBy({ id: batchId });
  if (
    !batch ||
    batch.source !== ImportSource.MOODLE ||
    batch.status !== ImportBatchStatus.STAGED ||
    readSummary(batch.summary).confirmedAt
  ) {
    return 'NOT_AUTO';
  }
  const run = await dataSource
    .getRepository(MoodleSyncRun)
    .createQueryBuilder('r')
    .where('r.mode = :mode', { mode: 'AUTO' })
    .andWhere('EXISTS (SELECT 1 FROM jsonb_each_text(r.batch_ids) e WHERE e.value = :batchId)', {
      batchId,
    })
    .getOne();
  if (!run) return 'NOT_AUTO';
  const errorRate = batch.totalRows === 0 ? 0 : batch.errorRows / batch.totalRows;
  if (errorRate > HIGH_ERROR_RATE) return 'NEEDS_REVIEW';
  await confirmImportBatch(batchId, await ensureMoodleSystemUser(), enqueue);
  return 'CONFIRMED';
}

/**
 * Lưới an toàn: lô của lần đồng bộ Tự động (7 ngày gần nhất) đã kiểm tra xong mà chưa xác nhận (VD
 * worker dừng giữa 2 bước) → thử tự xác nhận lại; lô nhiều lỗi vẫn chờ Admin. Gọi ở lịch dò.
 */
export async function retryAutoConfirm(
  enqueue: ImportEnqueuer = enqueueImportJob,
): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const runs = await (await getDataSource()).getRepository(MoodleSyncRun).find({
    where: { mode: 'AUTO', status: 'STAGED', createdAt: MoreThan(since) },
  });
  let confirmed = 0;
  for (const run of runs) {
    // Đã có lần mới hơn nạp cho cùng khóa → lô chờ này đã cũ: hủy (không được đè dữ liệu mới).
    if (await isSyncRunStale(run)) {
      await discardMoodleSync(run.id, await ensureMoodleSystemUser()).catch(() => undefined);
      continue;
    }
    for (const batchId of Object.values(run.batchIds)) {
      if (!batchId) continue;
      if ((await autoConfirmMoodleBatch(batchId, enqueue)) === 'CONFIRMED') confirmed += 1;
      else await reloadLostBatch(batchId, enqueue);
    }
  }
  return confirmed;
}

/** Lô đã xác nhận > 2 phút mà vẫn `STAGED` = job nạp bị mất (worker dừng) → đưa lại (nạp idempotent). */
async function reloadLostBatch(batchId: string, enqueue: ImportEnqueuer): Promise<void> {
  const batch = await (await getDataSource()).getRepository(ImportBatch).findOneBy({ id: batchId });
  const confirmedAt = batch ? readSummary(batch.summary).confirmedAt : undefined;
  if (batch?.status !== ImportBatchStatus.STAGED || !confirmedAt) return;
  if (Date.now() - new Date(confirmedAt).getTime() < 2 * 60_000) return;
  logger.warn({ batchId }, 'đồng bộ Moodle: lô đã xác nhận chưa được nạp — đưa lại vào hàng đợi');
  await enqueue('load', batchId);
}

// ── Đổi chế độ 1 khóa ──────────────────────────────────────────────────────────────────

/** Khóa đã có lô Moodle được nạp (Admin xem trước + xác nhận ít nhất 1 lần). */
async function hasLoadedMoodleData(link: MoodleCourseLink): Promise<boolean> {
  return (await getDataSource())
    .createQueryBuilder(ImportBatch, 'b')
    .innerJoin('import_batch_files', 'f', 'f.import_batch_id = b.id')
    .where('b.source = :source', { source: ImportSource.MOODLE })
    .andWhere('b.term_id = :termId', { termId: link.termId })
    .andWhere('b.status IN (:...done)', {
      done: [ImportBatchStatus.LOADED, ImportBatchStatus.RECONCILED],
    })
    .andWhere('f.file_name LIKE :name', { name: `%moodle-${link.sectionCode}-%` })
    .getExists();
}

/**
 * Chạy tay ↔ Tự động (Audit Log `MOODLE_LINK_UPDATED`). Bật Tự động chỉ khi khóa đang bật, đã nạp
 * xác nhận ít nhất 1 lần và không còn lô chờ — rồi kéo đủ ngay (đặt job hạn nộp).
 */
export async function setMoodleSyncMode(
  input: { linkId: string; syncMode: MoodleSyncMode },
  actorId: string,
  enqueueFlush: MoodleFlushEnqueuer = enqueueMoodleFlush,
): Promise<void> {
  const dataSource = await getDataSource();
  const link = await dataSource
    .getRepository(MoodleCourseLink)
    .findOne({ where: { id: input.linkId }, relations: { term: true } });
  if (!link) throw new AppError('LINK_NOT_FOUND', 'Không tìm thấy liên kết khóa học.');
  if (link.term?.closedAt) throw new AppError('TERM_CLOSED', `${link.term.termName} đã chốt.`);
  if (link.syncMode === input.syncMode) return;
  if (input.syncMode === 'AUTO') {
    if (!link.enabled) throw new AppError('LINK_DISABLED', 'Bật đồng bộ khóa học trước.');
    if (await hasPendingRun(link.termId, link.id)) {
      throw new AppError(
        'SYNC_PENDING',
        'Khóa còn dữ liệu chờ xác nhận — hãy Xác nhận nạp hoặc Hủy trước khi bật Tự động.',
      );
    }
    if (!(await hasLoadedMoodleData(link))) {
      throw new AppError(
        'AUTO_NEEDS_FIRST_SYNC',
        'Hãy Đồng bộ ngay, xem trước và Xác nhận nạp ít nhất 1 lần trước khi bật Tự động.',
      );
    }
  }
  const now = new Date();
  await dataSource.transaction(async (em) => {
    await em.update(
      MoodleCourseLink,
      { id: link.id },
      {
        syncMode: input.syncMode,
        updatedBy: actorId,
        pendingEventAt: input.syncMode === 'AUTO' ? now : null,
      },
    );
    await writeAuditLog(
      {
        actorId,
        action: 'MOODLE_LINK_UPDATED',
        targetType: 'MoodleCourseLink',
        targetId: link.id,
        detail: {
          termId: link.termId,
          sectionCode: link.sectionCode,
          before: { syncMode: link.syncMode },
          after: { syncMode: input.syncMode },
        },
      },
      em,
    );
  });
  if (input.syncMode === 'AUTO') await enqueueFlush(link.termId, now);
}

// ── Trạng thái cho trang Kết nối Moodle ────────────────────────────────────────────────

export interface MoodleAutoStatusDto {
  webhookConfigured: boolean;
  autoCourses: number;
  lastEventAt: string | null;
  eventsLast24h: number;
  lastCheckedAt: string | null;
}

export async function getMoodleAutoStatus(
  termId: string,
  webhookConfigured: boolean,
): Promise<MoodleAutoStatusDto> {
  const dataSource = await getDataSource();
  const links = await dataSource
    .getRepository(MoodleCourseLink)
    .find({ where: { termId, enabled: true, syncMode: 'AUTO' } });
  const courseIds = links.map((l) => l.moodleCourseId);
  const inbox = dataSource.getRepository(MoodleEventInbox);
  const last = courseIds.length
    ? await inbox.findOne({
        where: { moodleCourseId: In(courseIds) },
        order: { receivedAt: 'DESC' },
      })
    : null;
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const eventsLast24h = courseIds.length
    ? await inbox
        .createQueryBuilder('e')
        .where('e.moodle_course_id IN (:...courseIds)', { courseIds })
        .andWhere('e.received_at >= :since', { since })
        .getCount()
    : 0;
  const checked = links
    .map((l) => l.lastCheckedAt?.getTime() ?? 0)
    .filter((t) => t > 0)
    .sort((a, b) => b - a)[0];
  return {
    webhookConfigured,
    autoCourses: links.length,
    lastEventAt: last?.receivedAt.toISOString() ?? null,
    eventsLast24h,
    lastCheckedAt: checked ? new Date(checked).toISOString() : null,
  };
}

/** Dọn hộp thư sự kiện cũ (> 30 ngày) — gọi từ job dọn dẹp hằng ngày. */
export async function pruneMoodleEventInbox(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const result = await (
    await getDataSource()
  )
    .getRepository(MoodleEventInbox)
    .delete({ receivedAt: LessThanOrEqual(cutoff), eventId: Not(IsNull()) });
  return result.affected ?? 0;
}
