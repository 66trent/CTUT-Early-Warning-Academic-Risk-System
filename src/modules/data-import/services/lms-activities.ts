import { randomUUID } from 'node:crypto';
import { In } from 'typeorm';
import { type EntityManager } from 'typeorm';
import { type ImportBatch } from '@/db/entities/import-batch.entity';
import { LmsActivity } from '@/db/entities/lms-activity.entity';
import { type LmsActivityType } from '@/db/enums';
import { parseDate, parseDateTime, type Parsed, stripDiacritics } from '../parsing/values';

/** 1 bài LMS mà 1 dòng nguồn nhắc tới (docs/rules/10). */
export interface ActivityRef {
  courseId: string;
  sectionCode: string;
  activityType: LmsActivityType;
  activityKey: string;
  activityName: string;
  /** ISO có múi giờ, hoặc null khi bài không có hạn nộp. */
  dueAt: string | null;
}

export const activityRefKey = (r: Omit<ActivityRef, 'activityName' | 'dueAt'>) =>
  `${r.courseId}|${r.sectionCode}|${r.activityType}|${r.activityKey}`;

/** `ma_bai`; trống thì tên bài bỏ dấu, chữ thường, gộp khoảng trắng (docs/rules/10). */
export function activityKeyOf(code: string, name: string): string {
  const trimmed = code.trim();
  if (trimmed) return trimmed.toUpperCase();
  return stripDiacritics(name).trim().replace(/\s+/g, ' ');
}

/** Hạn nộp: ngày giờ, hoặc chỉ ngày → 23:59 giờ Việt Nam của ngày đó (docs/rules/10). */
export function parseDueAt(raw: string): Parsed<string> {
  const text = raw.trim();
  const dateTime = parseDateTime(text);
  if (dateTime.ok) return dateTime;
  const date = parseDate(text);
  return date.ok ? { ok: true, value: `${date.value}T23:59:00+07:00` } : date;
}

const sameTime = (a: Date | null, iso: string | null) =>
  (a?.getTime() ?? null) === (iso ? new Date(iso).getTime() : null);

/** Bài đã có trong hệ thống của các dòng (học kỳ của lô) — để cảnh báo đổi hạn nộp. */
export async function findActivities(
  em: EntityManager,
  termId: string,
  refs: readonly ActivityRef[],
): Promise<Map<string, LmsActivity>> {
  if (refs.length === 0) return new Map();
  const existing = await em.find(LmsActivity, {
    where: { termId, courseId: In([...new Set(refs.map((r) => r.courseId))]) },
  });
  return new Map(existing.map((a) => [activityRefKey(a), a]));
}

/** Nạp lại với hạn nộp khác (giảng viên gia hạn) → cảnh báo, vẫn cập nhật (docs/rules/10). */
export function dueDateChangeMessage(current: LmsActivity, ref: ActivityRef): string | null {
  if (sameTime(current.dueAt, ref.dueAt)) return null;
  const fmt = (d: Date | null) =>
    d ? d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'không có';
  return `Bài "${ref.activityName}" đổi hạn nộp từ ${fmt(current.dueAt)} sang ${fmt(ref.dueAt ? new Date(ref.dueAt) : null)}.`;
}

/**
 * Tìm hoặc tạo `LmsActivity` cho các dòng của lô; cập nhật tên / hạn nộp khi khác. Trả map
 * khóa bài → id và số bài đã cập nhật (tính vào `summary.updated` — chặn hoàn tác lô).
 */
export async function ensureActivities(
  em: EntityManager,
  batch: ImportBatch,
  refs: readonly ActivityRef[],
): Promise<{ ids: Map<string, string>; updated: number }> {
  const termId = batch.termId ?? '';
  const unique = [...new Map(refs.map((r) => [activityRefKey(r), r])).values()];
  const existing = await findActivities(em, termId, unique);
  const ids = new Map<string, string>();
  const inserts: Partial<LmsActivity>[] = [];
  let updated = 0;
  for (const ref of unique) {
    const key = activityRefKey(ref);
    const current = existing.get(key);
    const values = {
      activityName: ref.activityName,
      dueAt: ref.dueAt ? new Date(ref.dueAt) : null,
    };
    if (!current) {
      const id = randomUUID();
      inserts.push({ id, termId, ...ref, ...values, importBatchId: batch.id });
      ids.set(key, id);
    } else {
      ids.set(key, current.id);
      if (current.activityName !== ref.activityName || !sameTime(current.dueAt, ref.dueAt)) {
        await em.update(LmsActivity, { id: current.id }, { ...values, importBatchId: batch.id });
        updated += 1;
      }
    }
  }
  if (inserts.length > 0) await em.insert(LmsActivity, inserts);
  return { ids, updated };
}

/** Hoàn tác: xóa bài do lô tạo mà không còn lượt làm / bài nộp nào (docs/rules/12). */
export async function deleteOrphanActivities(em: EntityManager, batchId: string): Promise<void> {
  await em.query(
    `DELETE FROM lms_activities a
      WHERE a.import_batch_id = $1
        AND NOT EXISTS (SELECT 1 FROM lms_quiz_attempts q WHERE q.activity_id = a.id)
        AND NOT EXISTS (SELECT 1 FROM lms_assignment_submissions s WHERE s.activity_id = a.id)`,
    [batchId],
  );
}
