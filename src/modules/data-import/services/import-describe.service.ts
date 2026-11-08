/**
 * Mô tả ngắn 1 lô nạp cho thông báo "dữ liệu vừa cập nhật" (alerts — chuông, Phase 10c): nguồn (file /
 * Moodle), loại dữ liệu, học phần. Lô Moodle: gộp mọi lô của CÙNG lần đồng bộ (đánh giá tự gộp nên chỉ
 * ghi lô đầu tiên vào `EvaluationRun.importBatchId`).
 */
import { In } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { Course } from '@/db/entities/course.entity';
import { ImportBatchFile } from '@/db/entities/import-batch-file.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { MoodleSyncRun } from '@/db/entities/moodle-sync-run.entity';
import { ImportSource } from '@/db/enums';
import { getImportDefinition } from '../types/registry';

export interface ImportDescription {
  source: 'FILE' | 'MOODLE';
  /** Nhãn loại dữ liệu, VD "Điểm danh". */
  dataTypes: string[];
  courseIds: string[];
  courseNames: string[];
}

async function moodleBatchIds(batchId: string): Promise<string[]> {
  const run = await (
    await getDataSource()
  )
    .getRepository(MoodleSyncRun)
    .createQueryBuilder('r')
    .where('EXISTS (SELECT 1 FROM jsonb_each_text(r.batch_ids) e WHERE e.value = :batchId)', {
      batchId,
    })
    .getOne();
  const ids = run ? Object.values(run.batchIds).filter((id): id is string => Boolean(id)) : [];
  return ids.length > 0 ? ids : [batchId];
}

export async function describeImportBatch(batchId: string): Promise<ImportDescription | null> {
  const ds = await getDataSource();
  const batch = await ds.getRepository(ImportBatch).findOneBy({ id: batchId });
  if (!batch) return null;
  const moodle = batch.source === ImportSource.MOODLE;
  const ids = moodle ? await moodleBatchIds(batchId) : [batchId];
  const batches = await ds.getRepository(ImportBatch).findBy({ id: In(ids) });
  const files = await ds.getRepository(ImportBatchFile).find({
    select: { courseIds: true },
    where: { importBatchId: In(ids) },
  });
  const courseIds = [...new Set(files.flatMap((f) => f.courseIds))].sort();
  const courses = courseIds.length
    ? await ds.getRepository(Course).find({ where: { courseId: In(courseIds) } })
    : [];
  const name = new Map(courses.map((c) => [c.courseId, c.courseName]));
  return {
    source: moodle ? 'MOODLE' : 'FILE',
    dataTypes: [
      ...new Set(batches.map((b) => getImportDefinition(b.dataType)?.label ?? b.dataType)),
    ],
    courseIds,
    courseNames: courseIds.map((id) => name.get(id) ?? id),
  };
}
