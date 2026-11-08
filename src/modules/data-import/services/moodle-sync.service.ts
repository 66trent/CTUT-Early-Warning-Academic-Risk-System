/**
 * Đồng bộ Moodle (Phase 10b Chạy tay, 10c Tự động — docs/rules/12, docs/tich-hop-moodle.md 4, 9b, 9c).
 * 1 lần đồng bộ: đọc các khóa ĐÃ BẬT cùng chế độ của 1 học kỳ → mapper thuần → tối đa 3 lô nhập nguồn
 * `MOODLE` (1 file CSV / khóa) đi qua ĐÚNG đường nạp nhiều file có sẵn → `STAGED`. Chạy tay: "Xác
 * nhận nạp cả 3"; Tự động: tự xác nhận khi lỗi ≤ 10% (`moodle-auto.service`). File trùng file MỚI NHẤT
 * của cùng khóa bị bỏ qua; sinh viên Moodle chưa có trong EWARS bị bỏ qua và đếm riêng.
 */
import { type EntityManager, In, LessThan, MoreThanOrEqual, Not } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { MoodleCourseLink, type MoodleSeenActivity } from '@/db/entities/moodle-course-link.entity';
import {
  type MoodleSyncBatchIds,
  type MoodleSyncCourseStats,
  MoodleSyncRun,
  type MoodleSyncStats,
} from '@/db/entities/moodle-sync-run.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import {
  ImportBatchStatus,
  ImportSource,
  type MoodleSyncMode,
  type MoodleSyncTrigger,
  UserAccountStatus,
  UserRole,
} from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  MOODLE_SYSTEM_USER_EMAIL,
  MOODLE_SYSTEM_USER_ID,
  MOODLE_SYSTEM_USER_NAME,
} from '@/lib/system-accounts';
import { type MoodleClient } from '../moodle/client';
import { nextDepartures } from '../moodle/departures';
import {
  courseFingerprint,
  fetchGradeItems,
  fetchMoodleCourseBase,
  fetchQuizAttempts,
  type MoodleCourseBase,
} from '../moodle/fetch-course';
import {
  ASSIGNMENT_COLUMNS,
  ATTENDANCE_COLUMNS,
  type MoodleMappingOptions,
  mapMoodleCourse,
  QUIZ_COLUMNS,
  type StudentResolver,
  toCsv,
} from '../moodle/mappers';
import { readSummary } from './import-summary';
import {
  confirmImportBatch,
  createImportBatch,
  discardImportBatch,
  fileChecksum,
  findLatestFileChecksums,
  type ImportFileInput,
} from './import-batch.service';
import { enqueueImportJob, type ImportEnqueuer } from './import-queue';
import { describeMoodleError, getMoodleClientFromEnv } from './moodle-link.service';
import {
  enqueueMoodleSync,
  type MoodleDueJob,
  type MoodleDueScheduler,
  MOODLE_JOB,
  type MoodleSyncEnqueuer,
  scheduleMoodleDueJobs,
} from './moodle-queue';

export const MOODLE_SYNC_JOB = MOODLE_JOB.run;
export { enqueueMoodleSync, type MoodleSyncEnqueuer };

const SOURCES = [
  {
    dataType: 'ATTENDANCE_SUMMARY',
    columns: ATTENDANCE_COLUMNS,
    key: 'attendance',
    label: 'diem-danh',
  },
  { dataType: 'LMS_QUIZ', columns: QUIZ_COLUMNS, key: 'quiz', label: 'trac-nghiem' },
  {
    dataType: 'LMS_ASSIGNMENT',
    columns: ASSIGNMENT_COLUMNS,
    key: 'assignment',
    label: 'thuc-hanh',
  },
] as const;
type SyncDataType = (typeof SOURCES)[number]['dataType'];

const OPEN_RUN_STATUSES = ['QUEUED', 'RUNNING'] as const;
const LOADED_STATUSES: readonly ImportBatchStatus[] = [
  ImportBatchStatus.LOADED,
  ImportBatchStatus.RECONCILED,
];

const batchIdList = (ids: MoodleSyncBatchIds): string[] =>
  Object.values(ids).filter((id): id is string => typeof id === 'string');

const isPendingBatch = (b: Pick<ImportBatch, 'status' | 'summary'>) =>
  b.status === ImportBatchStatus.VALIDATING ||
  (b.status === ImportBatchStatus.STAGED && !readSummary(b.summary).confirmedAt);

function mappingOptions(): MoodleMappingOptions {
  const env = getEnv();
  const set = (raw: string) =>
    new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  return {
    periodMinutes: env.MOODLE_PERIOD_MINUTES,
    excused: set(env.MOODLE_EXCUSED_ACRONYMS),
    unexcused: set(env.MOODLE_UNEXCUSED_ACRONYMS),
  };
}

let systemUserReady = false;
/** Tài khoản hệ thống `SYSTEM_MOODLE` (không đăng nhập được) — tạo nếu chưa có. */
export async function ensureMoodleSystemUser(): Promise<string> {
  if (systemUserReady) return MOODLE_SYSTEM_USER_ID;
  await (
    await getDataSource()
  )
    .createQueryBuilder()
    .insert()
    .into(User)
    .values({
      userId: MOODLE_SYSTEM_USER_ID,
      fullName: MOODLE_SYSTEM_USER_NAME,
      email: MOODLE_SYSTEM_USER_EMAIL,
      role: UserRole.ADMIN,
      accountStatus: UserAccountStatus.SUSPENDED,
      authUserId: null,
    })
    .orIgnore()
    .execute();
  systemUserReady = true;
  return MOODLE_SYSTEM_USER_ID;
}

/** ID number = MSSV (không phân biệt hoa thường); trống/không khớp → email đã lưu (không suy MSSV từ email). */
export async function buildStudentResolver(): Promise<StudentResolver> {
  const rows = await (
    await getDataSource()
  )
    .getRepository(Student)
    .createQueryBuilder('s')
    .innerJoin(User, 'u', 'u.user_id = s.student_id')
    .select(['s.student_id AS mssv', 'u.email AS email'])
    .getRawMany<{ mssv: string; email: string | null }>();
  const byId = new Map(rows.map((r) => [r.mssv.toUpperCase(), r.mssv]));
  const byEmail = new Map(rows.filter((r) => r.email).map((r) => [r.email!.toLowerCase(), r.mssv]));
  return (user) =>
    byId.get(user.idnumber?.trim().toUpperCase() ?? '') ??
    byEmail.get(user.email?.trim().toLowerCase() ?? '') ??
    null;
}

async function batchesOf(runs: MoodleSyncRun[]): Promise<Map<string, ImportBatch>> {
  const ids = runs.flatMap((r) => batchIdList(r.batchIds));
  if (ids.length === 0) return new Map();
  const batches = await (await getDataSource()).getRepository(ImportBatch).find({
    select: { id: true, status: true, summary: true },
    where: { id: In(ids) },
  });
  return new Map(batches.map((b) => [b.id, b]));
}

const runLinkIds = (run: MoodleSyncRun) => (run.stats?.courses ?? []).map((c) => c.linkId);

/**
 * Lần đồng bộ Chạy tay còn lô chờ xác nhận — chặn đồng bộ mới chồng lên. `linkId`: chỉ tính lần có
 * khóa này (đổi khóa sang Tự động).
 */
export async function hasPendingRun(termId: string, linkId?: string): Promise<boolean> {
  const runs = await (await getDataSource()).getRepository(MoodleSyncRun).find({
    where: { termId, status: 'STAGED', mode: 'MANUAL' },
    order: { createdAt: 'DESC' },
    take: 10,
  });
  const relevant = linkId ? runs.filter((r) => runLinkIds(r).includes(linkId)) : runs;
  const batches = await batchesOf(relevant);
  return relevant.some((r) =>
    batchIdList(r.batchIds).some((id) => {
      const b = batches.get(id);
      return b ? isPendingBatch(b) : false;
    }),
  );
}

export interface CreateSyncRunInput {
  termId: string;
  trigger: MoodleSyncTrigger;
  mode: MoodleSyncMode;
  requestedBy: string;
  /** NULL = mọi khóa đã bật cùng chế độ. */
  linkIds: string[] | null;
}

/** Tạo lần đồng bộ `QUEUED`. Admin bấm (`MANUAL`) → Audit Log `MOODLE_SYNC_REQUESTED`. */
export async function createSyncRun(input: CreateSyncRunInput, courses: number): Promise<string> {
  return (await getDataSource()).transaction(async (em: EntityManager) => {
    const saved = await em.save(
      em.create(MoodleSyncRun, {
        ...input,
        status: 'QUEUED',
        batchIds: {},
        stats: null,
        errorMessage: null,
        finishedAt: null,
      }),
    );
    if (input.trigger === 'MANUAL') {
      await writeAuditLog(
        {
          actorId: input.requestedBy,
          action: 'MOODLE_SYNC_REQUESTED',
          targetType: 'MoodleSyncRun',
          targetId: saved.id,
          detail: { termId: input.termId, trigger: input.trigger, mode: input.mode, courses },
        },
        em,
      );
    }
    return saved.id;
  });
}

/**
 * Admin bấm "Đồng bộ ngay": tối đa 2 lần đồng bộ — khóa Chạy tay (lô chờ xác nhận) và khóa Tự động
 * (nạp luôn). Chặn khi lần Chạy tay trước còn chạy / còn lô chờ.
 */
export async function requestMoodleSync(
  termId: string,
  actorId: string,
  enqueue: MoodleSyncEnqueuer = enqueueMoodleSync,
): Promise<{ runIds: string[] }> {
  const dataSource = await getDataSource();
  const term = await dataSource.getRepository(Term).findOneBy({ termId });
  if (!term) throw new AppError('TERM_NOT_FOUND', 'Không tìm thấy học kỳ.');
  if (term.closedAt)
    throw new AppError('TERM_CLOSED', `${term.termName} đã chốt, không nhận thêm dữ liệu.`);
  const links = await dataSource.getRepository(MoodleCourseLink).findBy({ termId, enabled: true });
  if (links.length === 0)
    throw new AppError('NO_LINKED_COURSE', 'Chưa bật khóa học Moodle nào cho học kỳ này.');
  const count = (mode: MoodleSyncMode) => links.filter((l) => l.syncMode === mode).length;
  const runs = dataSource.getRepository(MoodleSyncRun);
  const created: string[] = [];
  if (count('MANUAL') > 0) {
    if (await runs.existsBy({ termId, mode: 'MANUAL', status: In([...OPEN_RUN_STATUSES]) })) {
      throw new AppError('SYNC_RUNNING', 'Đang có lần đồng bộ chạy cho học kỳ này — chờ xong.');
    }
    if (await hasPendingRun(termId)) {
      throw new AppError(
        'SYNC_PENDING',
        'Lần đồng bộ trước còn dữ liệu chờ xác nhận — hãy "Xác nhận nạp cả 3" hoặc "Hủy" trước.',
      );
    }
    const input = { termId, mode: 'MANUAL', trigger: 'MANUAL', requestedBy: actorId } as const;
    created.push(await createSyncRun({ ...input, linkIds: null }, count('MANUAL')));
  }
  // Khóa Tự động: lần đang chờ chạy đã bao gồm mọi khóa → không tạo thêm.
  if (count('AUTO') > 0 && !(await runs.existsBy({ termId, mode: 'AUTO', status: 'QUEUED' }))) {
    const input = { termId, mode: 'AUTO', trigger: 'MANUAL', requestedBy: actorId } as const;
    created.push(await createSyncRun({ ...input, linkIds: null }, count('AUTO')));
  }
  for (const runId of created) await enqueue(runId);
  return { runIds: created };
}

export interface RunMoodleSyncDeps {
  client?: MoodleClient;
  enqueueImport?: ImportEnqueuer;
  now?: Date;
  resolver?: StudentResolver;
  /** Tiền tố tên file sinh ra (test dùng `tst-` để bộ dọn dẹp nhận ra). */
  fileNamePrefix?: string;
  /** Đặt job hạn nộp (chỉ khóa Tự động). */
  scheduleDue?: MoodleDueScheduler;
}
type CollectDeps = Required<
  Pick<RunMoodleSyncDeps, 'client' | 'now' | 'resolver' | 'fileNamePrefix'>
>;

type FilesByType = Record<SyncDataType, ImportFileInput[]>;

/** Hạn nộp chung + hạn gia hạn riêng của mọi bài (job hạn nộp, kiểm hạn còn đúng). */
export function activitiesOf(base: MoodleCourseBase): MoodleSeenActivity[] {
  const quizzes = base.quizzes.map((q): MoodleSeenActivity => {
    const due = q.duedate || q.timeclose;
    return { kind: 'QUIZ', id: q.id, name: q.name, dues: due > 0 ? [due] : [] };
  });
  const assignments = base.assignments.map((a): MoodleSeenActivity => {
    const extensions = [...(base.extensions.get(a.id)?.values() ?? [])];
    const dues = [...new Set([a.duedate, ...extensions].filter((t) => t > 0))].sort();
    return { kind: 'ASSIGNMENT', id: a.id, name: a.name, dues };
  });
  return [...quizzes, ...assignments];
}

interface CollectedCourse {
  stat: MoodleSyncCourseStats;
  dueJobs: MoodleDueJob[];
}

/** Kéo đủ 1 khóa → file + cập nhật liên kết (dấu vân tay, rời khóa / bài đã xóa). */
async function collectCourse(
  link: MoodleCourseLink,
  deps: CollectDeps,
  files: FilesByType,
): Promise<CollectedCourse> {
  const repo = (await getDataSource()).getRepository(MoodleCourseLink);
  const stat: MoodleSyncCourseStats = {
    linkId: link.id,
    sectionCode: link.sectionCode,
    courseId: link.courseId,
    rows: { attendance: 0, quiz: 0, assignment: 0 },
    unknownStudents: 0,
    notes: [],
    error: null,
  };
  const startedAt = new Date();
  try {
    const base = await fetchMoodleCourseBase(deps.client, link.moodleCourseId);
    const known = (u: Parameters<StudentResolver>[0]) => deps.resolver(u) !== null;
    const attempts = await fetchQuizAttempts(deps.client, base, known);
    const mapped = mapMoodleCourse({ ...base, attempts }, link, deps.resolver, mappingOptions());
    for (const source of SOURCES) {
      const rows = mapped[source.key];
      stat.rows[source.key] = rows.length;
      if (rows.length === 0) continue;
      files[source.dataType].push({
        fileName: `${deps.fileNamePrefix}moodle-${link.sectionCode}-${source.label}.csv`,
        data: toCsv(source.columns, rows),
      });
    }
    stat.unknownStudents = mapped.unknownStudents.length;
    stat.notes = mapped.notes.slice(0, 20);
    const resolved = base.students.flatMap((u) => deps.resolver(u) ?? []);
    const fingerprint = await fetchGradeItems(deps.client, link.moodleCourseId)
      .then((grades) => courseFingerprint(base, grades, resolved))
      .catch(() => null);
    const activities = activitiesOf(base);
    await repo.update(
      { id: link.id },
      {
        lastSyncAt: deps.now,
        lastCheckedAt: deps.now,
        lastError: null,
        fingerprint,
        // Đã kéo đủ → sự kiện đến TRƯỚC lần kéo này đã được xử lý.
        ...(link.pendingEventAt && link.pendingEventAt <= startedAt
          ? { pendingEventAt: null }
          : {}),
        unknownStudents: mapped.unknownStudents.slice(0, 500),
        ...nextDepartures(link, resolved, activities, deps.now),
      },
    );
    const dueJobs = activities.flatMap((a) =>
      (a.dues ?? []).map((dueAt) => ({ linkId: link.id, kind: a.kind, activityId: a.id, dueAt })),
    );
    return { stat, dueJobs };
  } catch (error) {
    stat.error = describeMoodleError(error);
    logger.warn({ linkId: link.id, err: stat.error }, 'đồng bộ Moodle: lỗi đọc khóa học');
    await repo.update({ id: link.id }, { lastSyncAt: deps.now, lastError: stat.error });
    return { stat, dueJobs: [] };
  }
}

/** Mỗi loại dữ liệu: bỏ file trùng file mới nhất của khóa → 1 lô nhiều file nguồn `MOODLE`. */
async function stageFiles(
  run: MoodleSyncRun,
  files: FilesByType,
  enqueueImport: ImportEnqueuer,
): Promise<{ batchIds: MoodleSyncBatchIds; unchangedFiles: MoodleSyncStats['unchangedFiles'] }> {
  const batchIds: MoodleSyncBatchIds = {};
  const unchangedFiles: MoodleSyncStats['unchangedFiles'] = {};
  for (const { dataType } of SOURCES) {
    const candidates = files[dataType];
    const latest = await findLatestFileChecksums(
      candidates.map((f) => f.fileName),
      dataType,
      run.termId,
    );
    const changed = candidates.filter((f) => latest.get(f.fileName) !== fileChecksum(f.data));
    if (candidates.length > changed.length)
      unchangedFiles[dataType] = candidates.length - changed.length;
    if (changed.length === 0) continue;
    const { batchId } = await createImportBatch(
      {
        dataType,
        termId: run.termId,
        parentBatchId: null,
        source: ImportSource.MOODLE,
        files: changed,
      },
      run.requestedBy,
      enqueueImport,
    );
    batchIds[dataType] = batchId;
  }
  return { batchIds, unchangedFiles };
}

async function linksOf(run: MoodleSyncRun): Promise<MoodleCourseLink[]> {
  return (await getDataSource()).getRepository(MoodleCourseLink).find({
    where: {
      termId: run.termId,
      enabled: true,
      syncMode: run.mode,
      ...(run.linkIds ? { id: In(run.linkIds) } : {}),
    },
    order: { sectionCode: 'ASC' },
  });
}

/**
 * Job `moodle-sync`: chạy 1 lần đồng bộ. Idempotent theo trạng thái (chỉ chạy lần `QUEUED`/`RUNNING`
 * chưa tạo lô). Khóa Tự động: đặt job hạn nộp cho các hạn còn ở tương lai.
 */
export async function runMoodleSync(
  runId: string,
  deps: RunMoodleSyncDeps = {},
): Promise<MoodleSyncRun> {
  const runs = (await getDataSource()).getRepository(MoodleSyncRun);
  const run = await runs.findOneByOrFail({ id: runId });
  if (!(OPEN_RUN_STATUSES as readonly string[]).includes(run.status)) return run;
  await runs.update({ id: runId }, { status: 'RUNNING' });
  const now = deps.now ?? new Date();
  try {
    const collectDeps: CollectDeps = {
      client: deps.client ?? getMoodleClientFromEnv(),
      now,
      resolver: deps.resolver ?? (await buildStudentResolver()),
      fileNamePrefix: deps.fileNamePrefix ?? '',
    };
    const files: FilesByType = { ATTENDANCE_SUMMARY: [], LMS_QUIZ: [], LMS_ASSIGNMENT: [] };
    const collected: CollectedCourse[] = [];
    for (const link of await linksOf(run))
      collected.push(await collectCourse(link, collectDeps, files));
    const courses = collected.map((c) => c.stat);
    // Hoãn đưa lô vào hàng đợi kiểm tra tới khi lần đồng bộ đã ghi `batchIds`: bước tự xác nhận
    // (sau kiểm tra) tra lần đồng bộ theo id lô — kiểm tra chạy nhanh hơn thì không thấy (Phase 10c).
    const deferred: Parameters<ImportEnqueuer>[] = [];
    const { batchIds, unchangedFiles } = await stageFiles(run, files, (step, batchId) => {
      deferred.push([step, batchId]);
      return Promise.resolve();
    });
    if (run.mode === 'AUTO') {
      await (deps.scheduleDue ?? scheduleMoodleDueJobs)(
        collected.flatMap((c) => c.dueJobs),
        now,
      );
    }
    const allFailed = courses.length > 0 && courses.every((c) => c.error);
    const status = Object.keys(batchIds).length > 0 ? 'STAGED' : allFailed ? 'FAILED' : 'NO_CHANGE';
    await runs.update(
      { id: runId },
      {
        status,
        batchIds,
        stats: { courses, unchangedFiles },
        errorMessage: allFailed ? 'Không đọc được khóa học nào từ Moodle.' : null,
        finishedAt: new Date(),
      },
    );
    const enqueueImport = deps.enqueueImport ?? enqueueImportJob;
    for (const [step, batchId] of deferred) await enqueueImport(step, batchId);
    if (run.mode === 'AUTO' && status === 'STAGED') {
      await writeAuditLog({
        actorId: MOODLE_SYSTEM_USER_ID,
        action: 'MOODLE_SYNC_AUTO',
        targetType: 'MoodleSyncRun',
        targetId: runId,
        detail: { termId: run.termId, trigger: run.trigger, batchIds, courses: courses.length },
      });
    }
  } catch (error) {
    await runs.update(
      { id: runId },
      { status: 'FAILED', errorMessage: describeMoodleError(error), finishedAt: new Date() },
    );
    throw error;
  }
  return runs.findOneByOrFail({ id: runId });
}

/** Hết số lần thử của job → đánh dấu lỗi để trang không hiện "đang đồng bộ" mãi. */
export async function failMoodleSync(runId: string, reason: string | undefined): Promise<void> {
  await (await getDataSource()).getRepository(MoodleSyncRun).update(
    { id: runId, status: In([...OPEN_RUN_STATUSES]) },
    {
      status: 'FAILED',
      errorMessage: reason?.slice(0, 500) ?? 'Lỗi không rõ',
      finishedAt: new Date(),
    },
  );
}

/** 1 lần đồng bộ không chạy quá thời gian này — quá là bị gián đoạn (worker dừng giữa chừng). */
export const INTERRUPTED_RUN_MINUTES = 15;

/**
 * Lần đồng bộ treo `QUEUED`/`RUNNING` quá 15 phút (worker bị tắt khi đang chạy job gom / dò / hạn nộp
 * — job chạy lại không tạo lại đúng lần đó) → `FAILED`. Dữ liệu không mất: dấu vân tay của khóa chưa
 * cập nhật nên lần dò sau tự kéo lại. Gọi ở lịch dò thay đổi.
 */
export async function failInterruptedMoodleRuns(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - INTERRUPTED_RUN_MINUTES * 60_000);
  const result = await (await getDataSource()).getRepository(MoodleSyncRun).update(
    { status: In([...OPEN_RUN_STATUSES]), createdAt: LessThan(cutoff) },
    {
      status: 'FAILED',
      errorMessage: 'Bị gián đoạn (worker dừng giữa chừng) — lần dò thay đổi sau sẽ kéo lại.',
      finishedAt: now,
    },
  );
  return result.affected ?? 0;
}

async function runBatches(runId: string): Promise<{ run: MoodleSyncRun; batches: ImportBatch[] }> {
  const dataSource = await getDataSource();
  const run = await dataSource.getRepository(MoodleSyncRun).findOneBy({ id: runId });
  if (!run) throw new AppError('SYNC_NOT_FOUND', 'Không tìm thấy lần đồng bộ.');
  const ids = batchIdList(run.batchIds);
  const batches = ids.length
    ? await dataSource.getRepository(ImportBatch).find({ where: { id: In(ids) } })
    : [];
  return { run, batches };
}

/**
 * Đã có lần đồng bộ MỚI HƠN cùng học kỳ, chung khóa, có lô đã xác nhận / đã nạp → dữ liệu chờ của
 * lần này đã cũ (xác nhận sẽ ghi đè dữ liệu mới bằng dữ liệu cũ — Phase 10c).
 */
export async function isSyncRunStale(run: MoodleSyncRun): Promise<boolean> {
  const mine = new Set(runLinkIds(run));
  const later = (
    await (await getDataSource()).getRepository(MoodleSyncRun).find({
      // Loại chính nó: `createdAt` của JS chỉ tới mili-giây, cột timestamptz tới micro-giây → chính lần
      // này cũng "lớn hơn" mốc của nó.
      where: {
        id: Not(run.id),
        termId: run.termId,
        status: 'STAGED',
        createdAt: MoreThanOrEqual(run.createdAt),
      },
    })
  ).filter((r) => runLinkIds(r).some((id) => mine.has(id)));
  const batches = await batchesOf(later);
  return later.some((r) =>
    batchIdList(r.batchIds).some((id) => {
      const b = batches.get(id);
      return b
        ? LOADED_STATUSES.includes(b.status) || Boolean(readSummary(b.summary).confirmedAt)
        : false;
    }),
  );
}

/** Xác nhận nạp mọi lô của lần đồng bộ (Admin "Xác nhận nạp cả 3", hoặc hệ thống ở chế độ Tự động). */
export async function confirmMoodleSync(
  runId: string,
  actorId: string,
  enqueue: ImportEnqueuer = enqueueImportJob,
): Promise<{ confirmed: number }> {
  const { run, batches } = await runBatches(runId);
  if (run.status !== 'STAGED')
    throw new AppError('INVALID_STATUS', 'Lần đồng bộ không có dữ liệu chờ xác nhận.');
  if (
    batches.some(
      (b) => b.status === ImportBatchStatus.UPLOADING || b.status === ImportBatchStatus.VALIDATING,
    )
  ) {
    throw new AppError(
      'SYNC_VALIDATING',
      'Dữ liệu đang được kiểm tra — chờ vài giây rồi xác nhận.',
    );
  }
  const pending = batches.filter(
    (b) => b.status === ImportBatchStatus.STAGED && !readSummary(b.summary).confirmedAt,
  );
  if (pending.length === 0) throw new AppError('INVALID_STATUS', 'Không còn lô nào chờ xác nhận.');
  if (await isSyncRunStale(run)) {
    throw new AppError(
      'SYNC_STALE',
      'Đã có lần đồng bộ mới hơn được nạp cho khóa học này — dữ liệu đang chờ đã cũ. Hãy Hủy rồi Đồng bộ lại.',
    );
  }
  for (const batch of pending) await confirmImportBatch(batch.id, actorId, enqueue);
  await writeAuditLog({
    actorId,
    action: 'MOODLE_SYNC_CONFIRMED',
    targetType: 'MoodleSyncRun',
    targetId: runId,
    detail: { batchIds: pending.map((b) => b.id) },
  });
  return { confirmed: pending.length };
}

/** "Hủy": hủy mọi lô chưa xác nhận của lần đồng bộ. */
export async function discardMoodleSync(
  runId: string,
  actorId: string,
): Promise<{ discarded: number }> {
  const { batches } = await runBatches(runId);
  const pending = batches.filter(
    (b) => b.status === ImportBatchStatus.STAGED && !readSummary(b.summary).confirmedAt,
  );
  if (pending.length === 0) throw new AppError('INVALID_STATUS', 'Không còn lô nào để hủy.');
  for (const batch of pending) await discardImportBatch(batch.id, actorId);
  await writeAuditLog({
    actorId,
    action: 'MOODLE_SYNC_DISCARDED',
    targetType: 'MoodleSyncRun',
    targetId: runId,
    detail: { batchIds: pending.map((b) => b.id) },
  });
  return { discarded: pending.length };
}

export interface MoodleSyncBatchDto {
  dataType: SyncDataType;
  batchId: string;
  status: ImportBatchStatus;
  fileCount: number;
  totalRows: number;
  successRows: number;
  errorRows: number;
  confirmed: boolean;
}

export interface MoodleSyncRunDto {
  id: string;
  status: MoodleSyncRun['status'];
  trigger: MoodleSyncTrigger;
  mode: MoodleSyncMode;
  createdAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  courses: MoodleSyncCourseStats[];
  unchangedFiles: MoodleSyncStats['unchangedFiles'];
  batches: MoodleSyncBatchDto[];
  canConfirm: boolean;
  canDiscard: boolean;
  /** Tự động nhưng lô nhiều lỗi (> 10%) → chờ Admin xác nhận / hủy. */
  needsReview: boolean;
  /** Còn lô đang tải lên / kiểm tra → trang tự làm mới. */
  busy: boolean;
}

async function fileCountsOf(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await (
    await getDataSource()
  )
    .createQueryBuilder()
    .select('f.import_batch_id', 'batchId')
    .addSelect('COUNT(*)::int', 'count')
    .from('import_batch_files', 'f')
    .where('f.import_batch_id IN (:...ids)', { ids })
    .groupBy('f.import_batch_id')
    .getRawMany<{ batchId: string; count: number }>();
  return new Map(rows.map((r) => [r.batchId, Number(r.count)]));
}

function toBatchDto(batch: ImportBatch, dataType: SyncDataType, files: number): MoodleSyncBatchDto {
  return {
    dataType,
    batchId: batch.id,
    status: batch.status,
    fileCount: files,
    totalRows: batch.totalRows,
    successRows: batch.successRows,
    errorRows: batch.errorRows,
    confirmed: Boolean(readSummary(batch.summary).confirmedAt),
  };
}

function toRunDto(run: MoodleSyncRun, list: MoodleSyncBatchDto[]): MoodleSyncRunDto {
  const loading = (b: MoodleSyncBatchDto) =>
    b.status === ImportBatchStatus.UPLOADING || b.status === ImportBatchStatus.VALIDATING;
  const validating = list.some(loading);
  const pending = list.filter((b) => b.status === ImportBatchStatus.STAGED && !b.confirmed);
  const canConfirm = run.status === 'STAGED' && pending.length > 0 && !validating;
  return {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    mode: run.mode,
    createdAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    errorMessage: run.errorMessage,
    courses: run.stats?.courses ?? [],
    unchangedFiles: run.stats?.unchangedFiles ?? {},
    batches: list,
    canConfirm,
    canDiscard: run.status === 'STAGED' && pending.length > 0,
    needsReview: run.mode === 'AUTO' && canConfirm,
    busy:
      (OPEN_RUN_STATUSES as readonly string[]).includes(run.status) ||
      validating ||
      list.some((b) => b.confirmed && b.status === ImportBatchStatus.STAGED),
  };
}

/** Các lần đồng bộ gần nhất của học kỳ (mới nhất trước) — DTO thuần cho Client Component. */
export async function listMoodleSyncRuns(termId: string, limit = 5): Promise<MoodleSyncRunDto[]> {
  const dataSource = await getDataSource();
  const runs = await dataSource.getRepository(MoodleSyncRun).find({
    where: { termId },
    order: { createdAt: 'DESC' },
    take: limit,
  });
  const ids = runs.flatMap((r) => batchIdList(r.batchIds));
  const batches = ids.length
    ? await dataSource.getRepository(ImportBatch).find({ where: { id: In(ids) } })
    : [];
  const countOf = await fileCountsOf(ids);
  const byId = new Map(batches.map((b) => [b.id, b]));
  return runs.map((run) => {
    const list = SOURCES.flatMap(({ dataType }) => {
      const batch = byId.get(run.batchIds[dataType] ?? '');
      return batch ? [toBatchDto(batch, dataType, countOf.get(batch.id) ?? 1)] : [];
    });
    return toRunDto(run, list);
  });
}
