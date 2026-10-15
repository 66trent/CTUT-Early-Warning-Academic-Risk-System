import { getDataSource } from '@/db/data-source';
import { Term } from '@/db/entities/term.entity';

export interface TermOptionDto {
  termId: string;
  termName: string;
  isCurrent: boolean;
}

/** Học kỳ cho bộ lọc — mặc định học kỳ hiện tại (docs/rules/07). */
export async function listTermOptions(): Promise<TermOptionDto[]> {
  const terms = await (await getDataSource()).getRepository(Term).find({
    select: { termId: true, termName: true, isCurrent: true, startDate: true },
    order: { isCurrent: 'DESC', startDate: 'DESC' },
    take: 50,
  });
  return terms.map((t) => ({ termId: t.termId, termName: t.termName, isCurrent: t.isCurrent }));
}

/** Học kỳ được chọn trên URL nếu hợp lệ, ngược lại học kỳ hiện tại (hoặc mới nhất). */
export function pickTerm(
  terms: readonly TermOptionDto[],
  requested?: string,
): TermOptionDto | null {
  return (
    terms.find((t) => t.termId === requested) ?? terms.find((t) => t.isCurrent) ?? terms[0] ?? null
  );
}
