import { type EntityManager, type EntityTarget, type FindOptionsWhere } from 'typeorm';
import { type ImportBatch } from '@/db/entities/import-batch.entity';
import { deleteOrphanEnrollments, type StudentCoursePair } from './enrollment-sync';

/**
 * Hoàn tác lô dữ liệu nguồn (docs/rules/12): mọi dòng lô tạo phải vẫn mang `importBatchId` của
 * lô (điều kiện 3 — chưa bị lô khác cập nhật), rồi xóa các dòng đó + Enrollment mồ côi do lô tạo.
 * Trả lý do chặn, hoặc danh sách cặp (sinh viên, học phần) có Enrollment đã xóa.
 */
export async function rollbackSourceRows<T extends { importBatchId: string }>(
  entity: EntityTarget<T>,
  createdKeys: readonly string[],
  em: EntityManager,
  batch: ImportBatch,
): Promise<{ blocked: string } | { removedPairs: StudentCoursePair[] }> {
  const where = { importBatchId: batch.id } as FindOptionsWhere<T>;
  const stillOwned = await em.count(entity, { where });
  if (stillOwned !== createdKeys.length) {
    return {
      blocked:
        'Một số dòng của lô đã được lô nạp sau cập nhật — không hoàn tác được, hãy nạp file đúng để sửa.',
    };
  }
  await em.delete(entity, where);
  return { removedPairs: await deleteOrphanEnrollments(em, batch.id) };
}
