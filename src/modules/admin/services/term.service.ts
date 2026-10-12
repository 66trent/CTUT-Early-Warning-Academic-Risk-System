import { type EntityManager, IsNull } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { Term } from '@/db/entities/term.entity';
import { writeAuditLog } from '@/lib/audit';
import { toVnIsoDate, vnEndOfDay, vnStartOfDay } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { type CreateTerm, deriveTermIdentity } from '../validators/term';

export interface TermDto {
  termId: string;
  termName: string;
  academicYear: string;
  /** `YYYY-MM-DD` theo ngày Việt Nam. */
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  /** ISO 8601; null = chưa chốt. */
  closedAt: string | null;
}

export function toTermDto(term: Term): TermDto {
  return {
    termId: term.termId,
    termName: term.termName,
    academicYear: term.academicYear,
    startDate: toVnIsoDate(term.startDate),
    endDate: toVnIsoDate(term.endDate),
    isCurrent: term.isCurrent,
    closedAt: term.closedAt ? term.closedAt.toISOString() : null,
  };
}

/** Tên học kỳ hiện tại cho header; null khi chưa đặt học kỳ hiện tại. */
export async function getCurrentTermName(): Promise<string | null> {
  const repo = (await getDataSource()).getRepository(Term);
  const term = await repo.findOne({ select: { termName: true }, where: { isCurrent: true } });
  return term?.termName ?? null;
}

export async function listTerms(): Promise<TermDto[]> {
  const repo = (await getDataSource()).getRepository(Term);
  const terms = await repo.find({ order: { startDate: 'DESC' }, take: 200 });
  return terms.map(toTermDto);
}

/**
 * Đặt học kỳ hiện tại trong `em` (đang ở transaction): bỏ cờ của học kỳ cũ rồi bật học kỳ mới.
 * Partial unique index `UQ_terms_single_current` chặn mọi trường hợp còn lọt (lỗi 23505).
 */
async function switchCurrentTerm(em: EntityManager, termId: string): Promise<void> {
  await em.update(Term, { isCurrent: true }, { isCurrent: false });
  await em.update(Term, { termId }, { isCurrent: true });
}

export async function createTerm(input: CreateTerm, actorId: string): Promise<TermDto> {
  const identity = deriveTermIdentity(input.semester, input.startYear);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (em) => {
    if (await em.existsBy(Term, { termId: identity.termId })) {
      throw new AppError('TERM_EXISTS', `${identity.termName} đã có trong hệ thống.`);
    }
    await em.insert(Term, {
      ...identity,
      startDate: vnStartOfDay(input.startDate),
      endDate: vnEndOfDay(input.endDate),
      isCurrent: false,
      closedAt: null,
    });
    if (input.setAsCurrent) await switchCurrentTerm(em, identity.termId);
    await writeAuditLog(
      {
        actorId,
        action: 'TERM_CREATED',
        targetType: 'Term',
        targetId: identity.termId,
        detail: {
          startDate: input.startDate,
          endDate: input.endDate,
          setAsCurrent: input.setAsCurrent,
        },
      },
      em,
    );
    return toTermDto(await em.findOneByOrFail(Term, { termId: identity.termId }));
  });
}

export async function setCurrentTerm(termId: string, actorId: string): Promise<TermDto> {
  const dataSource = await getDataSource();
  return dataSource.transaction(async (em) => {
    const term = await em.findOneBy(Term, { termId });
    if (!term) throw new AppError('TERM_NOT_FOUND', 'Không tìm thấy học kỳ.');
    if (term.closedAt) {
      throw new AppError('TERM_CLOSED', 'Học kỳ đã chốt, không thể đặt làm học kỳ hiện tại.');
    }
    if (term.isCurrent) return toTermDto(term);

    const previous = await em.findOne(Term, {
      select: { termId: true },
      where: { isCurrent: true },
    });
    await switchCurrentTerm(em, termId);
    await writeAuditLog(
      {
        actorId,
        action: 'TERM_SET_CURRENT',
        targetType: 'Term',
        targetId: termId,
        detail: { previousTermId: previous?.termId ?? null },
      },
      em,
    );
    return toTermDto(await em.findOneByOrFail(Term, { termId }));
  });
}

/**
 * Chốt học kỳ sau khi nhập kết quả cuối kỳ: không nhận thêm dữ liệu điểm danh/LMS,
 * không tạo lần chạy đánh giá mới (docs/rules/08, 09). Không mở lại được.
 */
export async function closeTerm(termId: string, actorId: string): Promise<TermDto> {
  const dataSource = await getDataSource();
  return dataSource.transaction(async (em) => {
    const result = await em.update(Term, { termId, closedAt: IsNull() }, { closedAt: new Date() });
    if (!result.affected) {
      const exists = await em.existsBy(Term, { termId });
      throw exists
        ? new AppError('TERM_ALREADY_CLOSED', 'Học kỳ đã được chốt trước đó.')
        : new AppError('TERM_NOT_FOUND', 'Không tìm thấy học kỳ.');
    }
    await writeAuditLog(
      { actorId, action: 'TERM_CLOSED', targetType: 'Term', targetId: termId },
      em,
    );
    return toTermDto(await em.findOneByOrFail(Term, { termId }));
  });
}
