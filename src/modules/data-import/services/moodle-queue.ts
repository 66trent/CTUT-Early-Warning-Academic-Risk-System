/**
 * Job của queue `moodle-sync` (Phase 10b–10c — docs/tich-hop-moodle.md 4, 4c). jobId BullMQ KHÔNG được
 * chứa dấu `:` → dùng `_`.
 */
import { getQueue, QUEUE_NAMES } from '@/lib/queue/queues';

export const MOODLE_JOB = {
  /** 1 lần đồng bộ đã tạo (`MoodleSyncRun`). */
  run: 'moodle-sync-run',
  /** Gom sự kiện 30 giây / học kỳ → 1 lần đồng bộ các khóa có sự kiện. */
  flush: 'moodle-event-flush',
  /** Lịch 10 phút: dò dấu vân tay các khóa Tự động. */
  poll: 'moodle-poll',
  /** Mỗi đêm: kéo đủ các khóa Tự động + đánh giá. */
  nightly: 'moodle-nightly',
  /** Đúng lúc hết hạn nộp (+ 5 phút) của 1 bài. */
  due: 'moodle-due',
} as const;

/** Gom sự kiện trong cửa sổ này thành 1 lần đồng bộ. */
export const EVENT_FLUSH_MS = 30_000;
/** Job hạn nộp chạy sau hạn bao lâu. */
export const DUE_DELAY_MS = 5 * 60_000;

export type MoodleSyncEnqueuer = (runId: string) => Promise<void>;
export const enqueueMoodleSync: MoodleSyncEnqueuer = async (runId) => {
  await getQueue(QUEUE_NAMES.moodleSync).add(MOODLE_JOB.run, { runId }, { jobId: runId });
};

/** Đặt job gom của học kỳ (trùng cửa sổ 30 giây → BullMQ bỏ qua). */
export type MoodleFlushEnqueuer = (termId: string, now: Date) => Promise<void>;
export const enqueueMoodleFlush: MoodleFlushEnqueuer = async (termId, now) => {
  const window = Math.floor(now.getTime() / EVENT_FLUSH_MS);
  await getQueue(QUEUE_NAMES.moodleSync).add(
    MOODLE_JOB.flush,
    { termId },
    { jobId: `flush_${termId}_${window}`, delay: EVENT_FLUSH_MS },
  );
};

export interface MoodleDueJob {
  linkId: string;
  kind: 'QUIZ' | 'ASSIGNMENT';
  activityId: number;
  /** Hạn nộp (Unix giây). */
  dueAt: number;
}

/** Đặt job hạn nộp (cùng bài + cùng hạn → BullMQ bỏ qua; đổi hạn → job mới, job cũ tự bỏ qua). */
export type MoodleDueScheduler = (jobs: MoodleDueJob[], now: Date) => Promise<void>;
export const scheduleMoodleDueJobs: MoodleDueScheduler = async (jobs, now) => {
  const queue = getQueue(QUEUE_NAMES.moodleSync);
  for (const job of jobs) {
    const delay = job.dueAt * 1000 + DUE_DELAY_MS - now.getTime();
    if (delay <= 0) continue;
    await queue.add(MOODLE_JOB.due, job, {
      jobId: `due_${job.linkId}_${job.kind}${job.activityId}_${job.dueAt}`,
      delay,
    });
  }
};
