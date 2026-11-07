/**
 * Đồng bộ Moodle — chế độ Chạy tay (Phase 10b, docs/rules/12, docs/tich-hop-moodle.md mục 4, 9b).
 * 1 lần đồng bộ: đọc mọi khóa ĐÃ BẬT của 1 học kỳ → mapper thuần → tối đa 3 lô nhập nguồn `MOODLE`
 * (1 file CSV / khóa) đi qua ĐÚNG đường nạp nhiều file có sẵn → `STAGED` → "Xác nhận nạp cả 3".
 * File không đổi (cùng checksum với lô còn hiệu lực) bị bỏ qua; sinh viên Moodle chưa có trong EWARS
 * bị bỏ qua và đếm riêng (không ghi dòng lỗi).
 */
import { In } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { MoodleCourseLink } from '@/db/entities/moodle-course-link.entity';
import {
  type MoodleSyncBatchIds,
  type MoodleSyncCourseStats,
  MoodleSyncRun,
  type MoodleSyncStats,
} from '@/db/entities/moodle-sync-run.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import { ImportBatchStatus, ImportSource } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getQueue, QUEUE_NAMES } from '@/lib/queue/queues';
import { type MoodleClient } from '../moodle/client';
import { fetchMoodleCourse } from '../moodle/fetch-course';
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
  findLiveChecksums,
  type ImportFileInput,
} from './import-batch.service';
import { enqueueImportJob, type ImportEnqueuer } from './import-queue';
import { describeMoodleError, getMoodleClientFromEnv } from './moodle-link.service';

export const MOODLE_SYNC_JOB = 'moodle-sync-run';

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

const batchIdList = (ids: MoodleSyncBatchIds): string[] =>
  Object.values(ids).filter((id): id is string => typeof id === 'string');

export type MoodleSyncEnqueuer = (runId: string) => Promise<void>;
export const enqueueMoodleSync: MoodleSyncEnqueuer = async (runId) => {
  await getQueue(QUEUE_NAMES.moodleSync).add(MOODLE_SYNC_JOB, { runId }, { jobId: runId });
};

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

/** Lần đồng bộ còn lô chờ xác nhận (chưa xác nhận, chưa hủy) — chặn đồng bộ mới chồng lên. */
async function hasPendingRun(termId: string): Promise<boolean> {
  const dataSource = await getDataSource();
  const runs = await dataSource.getRepository(MoodleSyncRun).find({
    where: { termId, status: 'STAGED' },
    order: { createdAt: 'DESC' },
    take: 5,
  });
  const ids = runs.flatMap((r) => batchIdList(r.batchIds));
  if (ids.length === 0) return false;
  const batches = await dataSource.getRepository(ImportBatch).find({
    select: { id: true, status: true, summary: true },
    where: { id: In(ids) },
  });
  return batches.some(
    (b) =>
      b.status === ImportBatchStatus.VALIDATING ||
      (b.status === ImportBatchStatus.STAGED && !readSummary(b.summary).confirmedAt),
  );
}

/** Admin bấm "Đồng bộ ngay": tạo lần đồng bộ `QUEUED` + job (Audit Log `MOODLE_SYNC_REQUESTED`). */
export async function requestMoodleSync(
  termId: string,
  actorId: string,
  enqueue: MoodleSyncEnqueuer = enqueueMoodleSync,
): Promise<{ runId: string }> {
  const dataSource = await getDataSource();
  const term = await dataSource.getRepository(Term).findOneBy({ termId });
  if (!term) throw new AppError('TERM_NOT_FOUND', 'Không tìm thấy học kỳ.');
  if (term.closedAt)
    throw new AppError('TERM_CLOSED', `${term.termName} đã chốt, không nhận thêm dữ liệu.`);
  const enabled = await dataSource
    .getRepository(MoodleCourseLink)
    .countBy({ termId, enabled: true });
  if (enabled === 0)
    throw new AppError('NO_LINKED_COURSE', 'Chưa bật khóa học Moodle nào cho học kỳ này.');
  const runs = dataSource.getRepository(MoodleSyncRun);
  if (await runs.existsBy({ termId, status: In([...OPEN_RUN_STATUSES]) })) {
    throw new AppError('SYNC_RUNNING', 'Đang có lần đồng bộ chạy cho học kỳ này — chờ xong.');
  }
  if (await hasPendingRun(termId)) {
    throw new AppError(
      'SYNC_PENDING',
      'Lần đồng bộ trước còn dữ liệu chờ xác nhận — hãy "Xác nhận nạp cả 3" hoặc "Hủy" trước.',
    );
  }
  const run = await dataSource.transaction(async (em) => {
    const saved = await em.save(
      em.create(MoodleSyncRun, {
        termId,
        trigger: 'MANUAL',
        requestedBy: actorId,
        status: 'QUEUED',
        batchIds: {},
        stats: null,
        errorMessage: null,
        finishedAt: null,
      }),
    );
    await writeAuditLog(
      {
        actorId,
        action: 'MOODLE_SYNC_REQUESTED',
        targetType: 'MoodleSyncRun',
        targetId: saved.id,
        detail: { termId, trigger: 'MANUAL', courses: enabled },
      },
      em,
    );
    return saved;
  });
  await enqueue(run.id);
  return { runId: run.id };
}

export interface RunMoodleSyncDeps {
  client?: MoodleClient;
  enqueueImport?: ImportEnqueuer;
  now?: Date;
  resolver?: StudentResolver;
  /** Tiền tố tên file sinh ra (test dùng `tst-` để bộ dọn dẹp nhận ra). */
  fileNamePrefix?: string;
}

type FilesByType = Record<SyncDataType, ImportFileInput[]>;

/** Đọc + chuyển đổi từng khóa; lỗi 1 khóa không chặn khóa khác (ghi `lastError`). */
async function collectFiles(
  links: MoodleCourseLink[],
  deps: Required<Pick<RunMoodleSyncDeps, 'client' | 'now' | 'resolver' | 'fileNamePrefix'>>,
): Promise<{ files: FilesByType; courses: MoodleSyncCourseStats[] }> {
  const repo = (await getDataSource()).getRepository(MoodleCourseLink);
  const files: FilesByType = { ATTENDANCE_SUMMARY: [], LMS_QUIZ: [], LMS_ASSIGNMENT: [] };
  const courses: MoodleSyncCourseStats[] = [];
  const options = mappingOptions();
  for (const link of links) {
    const stat: MoodleSyncCourseStats = {
      linkId: link.id,
      sectionCode: link.sectionCode,
      courseId: link.courseId,
      rows: { attendance: 0, quiz: 0, assignment: 0 },
      unknownStudents: 0,
      notes: [],
      error: null,
    };
    try {
      const data = await fetchMoodleCourse(
        deps.client,
        link.moodleCourseId,
        (u) => deps.resolver(u) !== null,
      );
      const mapped = mapMoodleCourse(data, link, deps.resolver, options);
      for (const source of SOURCES) {
        const rows = mapped[source.key];
        stat.rows[source.key] = rows.length;
        if (rows.length > 0) {
          files[source.dataType].push({
            fileName: `${deps.fileNamePrefix}moodle-${link.sectionCode}-${source.label}.csv`,
            data: toCsv(source.columns, rows),
          });
        }
      }
      stat.unknownStudents = mapped.unknownStudents.length;
      stat.notes = mapped.notes.slice(0, 20);
      await repo.update(
        { id: link.id },
        {
          lastSyncAt: deps.now,
          lastError: null,
          unknownStudents: mapped.unknownStudents.slice(0, 500),
        },
      );
    } catch (error) {
      stat.error = describeMoodleError(error);
      logger.warn({ linkId: link.id, err: stat.error }, 'đồng bộ Moodle: lỗi đọc khóa học');
      await repo.update({ id: link.id }, { lastSyncAt: deps.now, lastError: stat.error });
    }
    courses.push(stat);
  }
  return { files, courses };
}

/**
 * Job `moodle-sync`: chạy 1 lần đồng bộ. Idempotent theo trạng thái (chỉ chạy lần `QUEUED`/`RUNNING`
 * chưa tạo lô). Mỗi loại dữ liệu: bỏ file không đổi → 1 lô nhiều file nguồn `MOODLE`.
 */
export async function runMoodleSync(
  runId: string,
  deps: RunMoodleSyncDeps = {},
): Promise<MoodleSyncRun> {
  const dataSource = await getDataSource();
  const runs = dataSource.getRepository(MoodleSyncRun);
  const run = await runs.findOneByOrFail({ id: runId });
  if (!(OPEN_RUN_STATUSES as readonly string[]).includes(run.status)) return run;
  await runs.update({ id: runId }, { status: 'RUNNING' });
  try {
    const links = await dataSource.getRepository(MoodleCourseLink).find({
      where: { termId: run.termId, enabled: true },
      order: { sectionCode: 'ASC' },
    });
    const { files, courses } = await collectFiles(links, {
      client: deps.client ?? getMoodleClientFromEnv(),
      now: deps.now ?? new Date(),
      resolver: deps.resolver ?? (await buildStudentResolver()),
      fileNamePrefix: deps.fileNamePrefix ?? '',
    });
    const batchIds: MoodleSyncBatchIds = {};
    const unchangedFiles: MoodleSyncStats['unchangedFiles'] = {};
    for (const { dataType } of SOURCES) {
      const candidates = files[dataType];
      const live = await findLiveChecksums(
        candidates.map((f) => fileChecksum(f.data)),
        dataType,
        run.termId,
      );
      const changed = candidates.filter((f) => !live.has(fileChecksum(f.data)));
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
        deps.enqueueImport ?? enqueueImportJob,
      );
      batchIds[dataType] = batchId;
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

/** "Xác nhận nạp cả 3": mọi lô của lần đồng bộ phải đã kiểm tra xong (`STAGED`). */
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
  createdAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  courses: MoodleSyncCourseStats[];
  unchangedFiles: MoodleSyncStats['unchangedFiles'];
  batches: MoodleSyncBatchDto[];
  canConfirm: boolean;
  canDiscard: boolean;
  /** Còn lô đang tải lên / kiểm tra → trang tự làm mới. */
  busy: boolean;
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
  const fileCounts = ids.length
    ? await dataSource
        .createQueryBuilder()
        .select('f.import_batch_id', 'batchId')
        .addSelect('COUNT(*)::int', 'count')
        .from('import_batch_files', 'f')
        .where('f.import_batch_id IN (:...ids)', { ids })
        .groupBy('f.import_batch_id')
        .getRawMany<{ batchId: string; count: number }>()
    : [];
  const countOf = new Map(fileCounts.map((r) => [r.batchId, Number(r.count)]));
  const byId = new Map(batches.map((b) => [b.id, b]));
  return runs.map((run) => {
    const list: MoodleSyncBatchDto[] = SOURCES.flatMap(({ dataType }) => {
      const batch = byId.get(run.batchIds[dataType] ?? '');
      if (!batch) return [];
      return [
        {
          dataType,
          batchId: batch.id,
          status: batch.status,
          fileCount: countOf.get(batch.id) ?? 1,
          totalRows: batch.totalRows,
          successRows: batch.successRows,
          errorRows: batch.errorRows,
          confirmed: Boolean(readSummary(batch.summary).confirmedAt),
        },
      ];
    });
    const busy =
      (OPEN_RUN_STATUSES as readonly string[]).includes(run.status) ||
      list.some(
        (b) =>
          b.status === ImportBatchStatus.UPLOADING || b.status === ImportBatchStatus.VALIDATING,
      ) ||
      list.some((b) => b.confirmed && b.status === ImportBatchStatus.STAGED);
    const pending = list.filter((b) => b.status === ImportBatchStatus.STAGED && !b.confirmed);
    const validating = list.some(
      (b) => b.status === ImportBatchStatus.UPLOADING || b.status === ImportBatchStatus.VALIDATING,
    );
    return {
      id: run.id,
      status: run.status,
      createdAt: run.createdAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      errorMessage: run.errorMessage,
      courses: run.stats?.courses ?? [],
      unchangedFiles: run.stats?.unchangedFiles ?? {},
      batches: list,
      canConfirm: run.status === 'STAGED' && pending.length > 0 && !validating,
      canDiscard: run.status === 'STAGED' && pending.length > 0,
      busy,
    };
  });
}
