import { getDataSource } from '@/db/data-source';
import { Term } from '@/db/entities/term.entity';

/** Tên học kỳ hiện tại cho header; null khi chưa đặt học kỳ hiện tại. */
export async function getCurrentTermName(): Promise<string | null> {
  const term = await (
    await getDataSource()
  )
    .getRepository(Term)
    .findOne({ select: { termName: true }, where: { isCurrent: true } });
  return term?.termName ?? null;
}
