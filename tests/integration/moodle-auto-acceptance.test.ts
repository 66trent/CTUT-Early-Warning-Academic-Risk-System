import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { MoodleCourseLink } from '@/db/entities/moodle-course-link.entity';
import { type MoodleSyncRun } from '@/db/entities/moodle-sync-run.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import { Term } from '@/db/entities/term.entity';
import { UpdateNotification } from '@/db/entities/update-notification.entity';
import { User } from '@/db/entities/user.entity';
import { ImportBatchStatus, Severity, UserAccountStatus, UserRole } from '@/db/enums';
import { getEnv } from '@/lib/env';
import { MOODLE_SYSTEM_USER_ID } from '@/lib/system-accounts';
import {
  listUpdateNotifications,
  notifyEvaluationCompleted,
} from '@/modules/alerts/services/update-notification.service';
import { type MoodleParams } from '@/modules/data-import/moodle/client';
import { createImportBatch } from '@/modules/data-import/services/import-batch.service';
import {
  loadImportBatch,
  validateImportBatch,
} from '@/modules/data-import/services/import-processor.service';
import { readSummary } from '@/modules/data-import/services/import-summary';
import {
  autoConfirmMoodleBatch,
  flushMoodleEvents,
  type MoodleAutoDeps,
  pollMoodleCourses,
  recordMoodleEvent,
  retryAutoConfirm,
  runMoodleDueJob,
  setMoodleSyncMode,
} from '@/modules/data-import/services/moodle-auto.service';
import { setMoodleLink } from '@/modules/data-import/services/moodle-link.service';
import { type MoodleDueJob } from '@/modules/data-import/services/moodle-queue';
import {
  confirmMoodleSync,
  listMoodleSyncRuns,
  requestMoodleSync,
  runMoodleSync,
} from '@/modules/data-import/services/moodle-sync.service';
import { requestEvaluationAfterImport } from '@/modules/rule-engine/services/evaluation-run.service';
import { cleanupDemo, endOf, evaluate, vn } from '../helpers/demo-setup';
import {
  confirmAndLoad,
  IMPORT_ACTOR,
  noEnqueue,
  useMemoryStorage,
} from '../helpers/import-helpers';
import { createFixtureMoodleClient, fixtureCutoff } from '../helpers/moodle-fixtures';

/**
 * Chế độ Tự động (Phase 10c — docs/tich-hop-moodle.md 4a–4c, 9c) với máy chủ Moodle giả (fixture
 * ngày chốt 06/11/2026). Kịch bản: Chạy tay lần đầu → bật Tự động → sự kiện điểm danh vắng → tự nạp
 * → cảnh báo; sửa lại như cũ vẫn nạp; lô nhiều lỗi chờ Admin + chặn xác nhận dữ liệu cũ; lịch dò
 * thay đổi; rời khóa; job hạn nộp.
 */
let ds: DataSource;
const TERM = 'TSTHK1_26';
const CLS = 'TSTL2411';
const ADVISOR = 'TSTGVL';
const MMT = { moodleId: 14, section: 'TST010089201', course: 'TST0100892', attendanceId: 12 };
const HDH = { moodleId: 15, section: 'TST010089101', course: 'TST0100891' };
const syncAt = endOf(fixtureCutoff());
const toTest = (json: string) =>
  json.replaceAll('KTPM2411', CLS).replaceAll('ktpm2411', CLS.toLowerCase());

/** Thay đổi "trên Moodle" — áp lên phản hồi fixture. */
type Patch = (fn: string, params: MoodleParams, response: unknown) => unknown;
let patches: Patch[] = [];
const client = createFixtureMoodleClient({
  transform: toTest,
  patch: (fn, params, response) => patches.reduce((r, p) => p(fn, params, r), response),
});

interface Session {
  statuses: { id: number; acronym: string }[];
  attendance_log: { studentid: number; statusid: number | string }[];
}
/** Sinh viên Moodle `userId` vắng không phép (A) mọi buổi đã điểm danh của Mạng máy tính. */
const absentAll =
  (userId: number): Patch =>
  (fn, params, response) => {
    if (fn !== 'mod_attendance_get_sessions' || params.attendanceid !== MMT.attendanceId)
      return response;
    return (response as Session[]).map((s) => {
      const absent = s.statuses.find((x) => x.acronym === 'A')?.id ?? 0;
      return {
        ...s,
        attendance_log: s.attendance_log.map((l) =>
          l.studentid === userId ? { ...l, statusid: absent } : l,
        ),
      };
    });
  };
/** Lượt trắc nghiệm đã nộp nhưng chưa có điểm (câu tự luận chờ chấm) → dòng lỗi "thiếu điểm". */
const ungraded: Patch = (fn, _params, response) =>
  fn === 'mod_quiz_get_user_quiz_attempts'
    ? {
        ...(response as object),
        attempts: (response as { attempts: { state: string }[] }).attempts.map((a) =>
          a.state === 'finished' ? { ...a, sumgrades: null } : a,
        ),
      }
    : response;
const unenrol =
  (idnumber: string): Patch =>
  (fn, params, response) =>
    fn === 'core_enrol_get_enrolled_users' && params.courseid === MMT.moodleId
      ? (response as { idnumber?: string }[]).filter((u) => u.idnumber !== idnumber)
      : response;

const flushed: string[] = [];
const dueJobs: MoodleDueJob[] = [];
const deps: MoodleAutoDeps = {
  client,
  now: syncAt,
  enqueueImport: noEnqueue,
  enqueueEvaluation: noEnqueue,
  fileNamePrefix: 'tst-',
  termId: TERM,
  scheduleDue: (jobs) => {
    dueJobs.push(...jobs);
    return Promise.resolve();
  },
};
const captureFlush = (termId: string) => {
  flushed.push(termId);
  return Promise.resolve();
};
const eventIds: string[] = [];

const linkOf = (moodleId: number) =>
  ds.getRepository(MoodleCourseLink).findOneByOrFail({ termId: TERM, moodleCourseId: moodleId });
const batchOf = (id: string | undefined) =>
  ds.getRepository(ImportBatch).findOneByOrFail({ id: id ?? '' });

/** Worker làm sau khi lần đồng bộ Tự động tạo lô: kiểm tra → tự xác nhận → nạp. */
async function processAutoBatches(run: MoodleSyncRun): Promise<string[]> {
  const outcomes: string[] = [];
  for (const batchId of Object.values(run.batchIds)) {
    await validateImportBatch(batchId);
    const outcome = await autoConfirmMoodleBatch(batchId, noEnqueue);
    outcomes.push(outcome);
    if (outcome === 'CONFIRMED') {
      await loadImportBatch(batchId, { retried: false, afterReconciled: noEnqueue });
    }
  }
  return outcomes;
}

async function moodleEvent(eventName: string, moodleCourseId = MMT.moodleId) {
  const eventId = randomUUID();
  eventIds.push(eventId);
  const event = { eventId, eventName, moodleCourseId, objectId: 1, occurredAt: syncAt };
  return { eventId, result: await recordMoodleEvent(event, syncAt, captureFlush) };
}

async function cleanup(): Promise<void> {
  await cleanupDemo(ds);
  await ds.query(`DELETE FROM users WHERE user_id = $1`, [ADVISOR]);
  if (eventIds.length) {
    await ds.query(`DELETE FROM moodle_event_inbox WHERE event_id = ANY($1::uuid[])`, [eventIds]);
  }
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await cleanup();
  await ds.getRepository(User).insert({
    userId: ADVISOR,
    fullName: 'Cố vấn thử Moodle',
    email: 'tstgvl@ctuet.edu.vn',
    role: UserRole.ADVISOR,
    accountStatus: UserAccountStatus.ACTIVE,
    authUserId: null,
  });
  await ds.getRepository(AdministrativeClass).insert({
    classId: CLS,
    className: 'Lớp thử Moodle',
    departmentId: 'K.CNTT',
    majorId: 'KTPM',
    cohortYear: '2024',
    advisorId: ADVISOR,
  });
  await ds.getRepository(Term).insert({
    termId: TERM,
    termName: 'Học kỳ thử Moodle',
    academicYear: '2026-2027',
    startDate: vn('2026-08-16'),
    endDate: vn('2026-12-27', '23:59:59'),
    isCurrent: false,
  });
  const header = 'mssv,ho_ten,email,ma_lop_sinh_hoat,trang_thai_hoc_vu';
  const lines = readFileSync('docs/demo-data/01_sinh_vien.csv', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes(',KTPM2411,'));
  const { batchId } = await createImportBatch(
    {
      dataType: 'STUDENT',
      termId: null,
      parentBatchId: null,
      fileName: 'tst-moodle-auto-sinh-vien.csv',
      data: Buffer.from(toTest([header, ...lines].join('\n')), 'utf8'),
    },
    IMPORT_ACTOR,
    noEnqueue,
  );
  await validateImportBatch(batchId);
  await confirmAndLoad(ds, batchId);
  for (const c of [MMT, HDH]) {
    await setMoodleLink(
      { termId: TERM, moodleCourseId: c.moodleId, enabled: true },
      IMPORT_ACTOR,
      client,
    );
    await ds
      .getRepository(MoodleCourseLink)
      .update(
        { termId: TERM, moodleCourseId: c.moodleId },
        { sectionCode: c.section, courseId: c.course },
      );
  }
}, 180_000);

afterAll(async () => {
  await cleanup();
  await closeDataSource();
});

describe('Đồng bộ Moodle — chế độ Tự động (Phase 10c)', () => {
  it('chưa xác nhận lần nào → không bật được Tự động; còn lô chờ → cũng không', async () => {
    const mmt = await linkOf(MMT.moodleId);
    await expect(
      setMoodleSyncMode({ linkId: mmt.id, syncMode: 'AUTO' }, IMPORT_ACTOR, captureFlush),
    ).rejects.toMatchObject({ code: 'AUTO_NEEDS_FIRST_SYNC' });
    const { runIds } = await requestMoodleSync(TERM, IMPORT_ACTOR, noEnqueue);
    expect(runIds).toHaveLength(1);
    const run = await runMoodleSync(runIds[0] ?? '', { ...deps, scheduleDue: undefined });
    await expect(
      setMoodleSyncMode({ linkId: mmt.id, syncMode: 'AUTO' }, IMPORT_ACTOR, captureFlush),
    ).rejects.toMatchObject({ code: 'SYNC_PENDING' });
    for (const id of Object.values(run.batchIds)) await validateImportBatch(id);
    await confirmMoodleSync(run.id, IMPORT_ACTOR, noEnqueue);
    for (const id of Object.values(run.batchIds)) {
      await loadImportBatch(id, { retried: false, afterReconciled: noEnqueue });
    }
    expect(dueJobs).toHaveLength(0); // Chạy tay không đặt job hạn nộp
  });

  it('bật Tự động → kéo đủ ngay: không có gì mới, đặt job hạn nộp, lưu dấu vân tay', async () => {
    for (const c of [MMT, HDH]) {
      const link = await linkOf(c.moodleId);
      await setMoodleSyncMode({ linkId: link.id, syncMode: 'AUTO' }, IMPORT_ACTOR, captureFlush);
    }
    expect(flushed).toEqual([TERM, TERM]);
    const run = await flushMoodleEvents(TERM, deps);
    expect(run).toMatchObject({ trigger: 'EVENT', mode: 'AUTO', status: 'NO_CHANGE' });
    expect(run?.requestedBy).toBe(MOODLE_SYSTEM_USER_ID);
    const mmt = await linkOf(MMT.moodleId);
    expect(mmt.pendingEventAt).toBeNull();
    expect(mmt.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(mmt.seenStudentIds).toHaveLength(20);
    expect(mmt.seenActivities.length).toBeGreaterThan(0);
    // Mỗi hạn nộp đã biết → 1 job (scheduler tự bỏ hạn đã qua).
    const known = [MMT, HDH].length;
    expect(new Set(dueJobs.map((j) => j.linkId)).size).toBe(known);
    expect(await flushMoodleEvents(TERM, deps)).toBeNull(); // không còn sự kiện chờ
  });

  it('lịch 10 phút: Moodle không đổi → không tạo lần đồng bộ nào', async () => {
    expect(await pollMoodleCourses(deps)).toEqual([]);
    expect((await linkOf(MMT.moodleId)).lastCheckedAt).toEqual(syncAt);
  });

  it('giảng viên điểm danh 901 vắng → sự kiện → tự nạp (lỗi 0%) → cảnh báo ATT-01 vượt ngưỡng', async () => {
    patches = [absentAll(5)]; // user Moodle 5 = TSTL2411901
    const { eventId, result } = await moodleEvent('\\mod_attendance\\event\\attendance_taken');
    expect(result).toEqual({ duplicate: false, queuedTerms: [TERM] });
    const again = await recordMoodleEvent(
      {
        eventId,
        eventName: '\\mod_attendance\\event\\attendance_taken',
        moodleCourseId: MMT.moodleId,
        objectId: 1,
        occurredAt: syncAt,
      },
      syncAt,
      captureFlush,
    );
    expect(again.duplicate).toBe(true); // Moodle gửi lại cùng sự kiện
    const run = await flushMoodleEvents(TERM, deps);
    expect(run?.status).toBe('STAGED');
    expect(Object.keys(run?.batchIds ?? {})).toEqual(['ATTENDANCE_SUMMARY']); // chỉ file MMT đổi
    expect(await processAutoBatches(run!)).toEqual(['CONFIRMED']);
    const batch = await batchOf(run?.batchIds.ATTENDANCE_SUMMARY);
    expect(batch.status).toBe(ImportBatchStatus.RECONCILED);
    expect(readSummary(batch.summary).confirmedBy).toBe(MOODLE_SYSTEM_USER_ID);
    // DEMO_MODE vẫn tự đánh giá lô Moodle tự động (lô Chạy tay thì không).
    const autoRun = await requestEvaluationAfterImport(batch, noEnqueue);
    expect(autoRun).not.toBeNull();
    // Chuông: lần đánh giá sau lô Moodle → tiêu đề nêu nguồn + học phần; CVHT lớp có SV học phần đó.
    await notifyEvaluationCompleted(autoRun ?? '', []);
    const bell = await ds
      .getRepository(UpdateNotification)
      .findBy({ evaluationRunId: autoRun ?? '' });
    const advisorBell = bell.find((n) => n.recipientId === ADVISOR);
    expect(advisorBell?.title).toBe('Moodle: Điểm danh · Mạng máy tính vừa cập nhật');
    expect(advisorBell?.body).toBe(`Lớp ${CLS}: không có thay đổi cảnh báo`);
    expect(bell.find((n) => n.recipientId === IMPORT_ACTOR)?.link).toBe(
      `/admin/evaluations/${autoRun}`,
    );
    expect(bell.some((n) => n.recipientId === MOODLE_SYSTEM_USER_ID)).toBe(false);
    await ds.query(`DELETE FROM evaluation_runs WHERE id = $1`, [autoRun]);
    if (getEnv().DEMO_MODE) {
      const manual = { id: batch.id, termId: TERM, summary: { confirmedBy: IMPORT_ACTOR } };
      expect(await requestEvaluationAfterImport(manual, noEnqueue)).toBeNull();
    }
    const evaluationId = await evaluate(TERM, syncAt);
    const att = await ds.getRepository(RuleTrigger).findOneBy({
      evaluationRunId: evaluationId,
      studentId: `${CLS}901`,
      ruleCode: 'ATT-01',
    });
    expect(att?.severity).toBe(Severity.CRITICAL);
    // Lần chạy tay (không có lô) → CVHT nhận vì lớp có cảnh báo mới.
    const mine = await ds
      .getRepository(UpdateNotification)
      .findOneBy({ evaluationRunId: evaluationId, recipientId: ADVISOR });
    expect(mine?.title).toBe('Admin chạy đánh giá');
    expect(mine?.body).toMatch(new RegExp(`^Lớp ${CLS}: \\d+ cảnh báo mới`));
    const listed = await listUpdateNotifications(ADVISOR);
    expect(listed.unread).toBeGreaterThanOrEqual(1);
    expect(Object.getPrototypeOf(listed.items[0])).toBe(Object.prototype);
  });

  it('sửa điểm danh lại như cũ → file giống 1 lô cũ hơn vẫn được nạp (không bị bỏ qua nhầm)', async () => {
    patches = [];
    await moodleEvent('\\mod_attendance\\event\\session_report_updated');
    const run = await flushMoodleEvents(TERM, deps);
    expect(run?.status).toBe('STAGED');
    expect(await processAutoBatches(run!)).toEqual(['CONFIRMED']);
    expect((await batchOf(run?.batchIds.ATTENDANCE_SUMMARY)).status).toBe(
      ImportBatchStatus.RECONCILED,
    );
  });

  it('lô chỉ vào hàng đợi kiểm tra SAU khi lần đồng bộ ghi xong; lô bị sót được lịch dò tự xác nhận', async () => {
    patches = [absentAll(6)]; // 902 vắng — chỉ để có dữ liệu mới
    await moodleEvent('\\mod_attendance\\event\\attendance_taken');
    const seenAtEnqueue: boolean[] = [];
    const run = await flushMoodleEvents(TERM, {
      ...deps,
      enqueueImport: async (_step, batchId) => {
        const rows = await ds.query<unknown[]>(
          `SELECT 1 FROM moodle_sync_runs r, jsonb_each_text(r.batch_ids) e WHERE e.value = $1`,
          [batchId],
        );
        seenAtEnqueue.push(rows.length > 0);
      },
    });
    expect(seenAtEnqueue).toEqual([true]); // bước tự xác nhận tìm được lần đồng bộ
    // Worker dừng giữa "kiểm tra" và "tự xác nhận" → lô kẹt chờ; lịch dò gỡ.
    const batchId = run?.batchIds.ATTENDANCE_SUMMARY ?? '';
    await validateImportBatch(batchId);
    expect(await retryAutoConfirm(noEnqueue)).toBe(1);
    // Đã xác nhận nhưng job nạp bị mất (worker dừng) → quá 2 phút, lịch dò đưa lại vào hàng đợi nạp.
    await ds.query(
      `UPDATE import_batches SET summary = jsonb_set(summary, '{confirmedAt}', to_jsonb($2::text)) WHERE id = $1`,
      [batchId, new Date(Date.now() - 3 * 60_000).toISOString()],
    );
    const requeued: string[] = [];
    await retryAutoConfirm((step, id) => {
      requeued.push(`${step}:${id}`);
      return Promise.resolve();
    });
    expect(requeued).toContain(`load:${batchId}`);
    await loadImportBatch(batchId, { retried: false, afterReconciled: noEnqueue });
    expect((await batchOf(batchId)).status).toBe(ImportBatchStatus.RECONCILED);
    patches = [];
  });

  let reviewRun: MoodleSyncRun | null = null;
  it('lô nhiều lỗi (> 10%) → không tự nạp, "Cần Admin xem"', async () => {
    patches = [ungraded];
    await moodleEvent('\\mod_quiz\\event\\attempt_regraded', HDH.moodleId);
    reviewRun = await flushMoodleEvents(TERM, deps);
    expect(Object.keys(reviewRun?.batchIds ?? {})).toEqual(['LMS_QUIZ']);
    expect(await processAutoBatches(reviewRun!)).toEqual(['NEEDS_REVIEW']);
    const dto = (await listMoodleSyncRuns(TERM, 10)).find((r) => r.id === reviewRun?.id);
    expect(dto).toMatchObject({ mode: 'AUTO', needsReview: true, canConfirm: true });
  });

  it('dữ liệu tốt về sau đã tự nạp → xác nhận lô cũ đang chờ bị chặn (dữ liệu đã cũ)', async () => {
    patches = [];
    await moodleEvent('\\mod_quiz\\event\\attempt_regraded', HDH.moodleId);
    const run = await flushMoodleEvents(TERM, deps);
    expect(await processAutoBatches(run!)).toEqual(['CONFIRMED']);
    await expect(
      confirmMoodleSync(reviewRun?.id ?? '', IMPORT_ACTOR, noEnqueue),
    ).rejects.toMatchObject({ code: 'SYNC_STALE' });
  });

  it('lịch 10 phút: sinh viên rời khóa trên Moodle → chỉ kéo khóa đó, liệt kê cho Admin', async () => {
    patches = [unenrol(`${CLS}905`)];
    const runs = await pollMoodleCourses(deps);
    expect(runs.map((r) => [r.trigger, r.linkIds])).toEqual([
      ['SCHEDULED', [(await linkOf(MMT.moodleId)).id]],
    ]);
    const mmt = await linkOf(MMT.moodleId);
    expect(mmt.leftStudents.map((s) => s.studentId)).toEqual([`${CLS}905`]);
    expect(mmt.seenStudentIds).not.toContain(`${CLS}905`);
    patches = [];
  });

  it('job gom sự kiện bị mất (Redis khởi động lại) → lịch dò vẫn kéo khóa đó, xóa dấu chờ', async () => {
    const hdh = await linkOf(HDH.moodleId);
    await ds
      .getRepository(MoodleCourseLink)
      .update({ id: hdh.id }, { pendingEventAt: new Date(Date.now() - 5 * 60_000) });
    // Worker bị tắt giữa 1 lần đồng bộ (job chạy lại không tạo lại đúng lần đó) → treo RUNNING.
    const [stuck] = await ds.query<{ id: string }[]>(
      `INSERT INTO moodle_sync_runs (term_id, trigger, mode, requested_by, status, created_at)
       VALUES ($1, 'EVENT', 'AUTO', $2, 'RUNNING', now() - interval '20 minutes') RETURNING id`,
      [TERM, MOODLE_SYSTEM_USER_ID],
    );
    const runs = await pollMoodleCourses(deps);
    const interrupted = await ds.query<{ status: string }[]>(
      `SELECT status FROM moodle_sync_runs WHERE id = $1`,
      [stuck?.id],
    );
    expect(interrupted).toEqual([{ status: 'FAILED' }]);
    // HDH không đổi dữ liệu (dấu vân tay giống) nhưng vẫn được kéo; MMT kéo vì 905 vừa ghi danh lại.
    expect(runs.flatMap((r) => r.linkIds ?? [])).toContain(hdh.id);
    expect((await linkOf(HDH.moodleId)).pendingEventAt).toBeNull();
  });

  it('job hạn nộp: hạn đã đổi → bỏ qua; hạn đúng → kéo lại khóa + đánh giá dù không có gì mới', async () => {
    const hdh = await linkOf(HDH.moodleId);
    const activity = hdh.seenActivities.find((a) => (a.dues ?? []).length > 0);
    expect(activity).toBeDefined();
    const job = {
      linkId: hdh.id,
      kind: activity!.kind,
      activityId: activity!.id,
      dueAt: activity!.dues![0],
    };
    expect(await runMoodleDueJob({ ...job, dueAt: job.dueAt + 60 }, deps)).toEqual({
      skipped: 'hạn nộp đã đổi',
    });
    const result = await runMoodleDueJob(job, deps);
    expect(result).toMatchObject({ evaluationRunId: expect.any(String) as string });
  });
});
