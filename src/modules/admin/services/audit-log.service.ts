import { Brackets } from 'typeorm';
import { z } from 'zod';
import { getDataSource } from '@/db/data-source';
import { AuditLog } from '@/db/entities/audit-log.entity';
import { User } from '@/db/entities/user.entity';
import { AUDIT_ACTIONS, type AuditAction } from '@/lib/audit';
import { vnEndOfDay, vnStartOfDay } from '@/lib/dates';
import { applyOrder, firstPage, type ListParams, type Paged, pageOffset } from '@/lib/list-params';
import { escapeLike } from './student-search.service';

export const AUDIT_SORT_KEYS = ['createdAt', 'action'] as const;
export type AuditSortKey = (typeof AUDIT_SORT_KEYS)[number];
export const AUDIT_DEFAULT_SORT = { sort: 'createdAt', dir: 'desc' } as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

/** Bộ lọc đọc từ URL — giá trị sai bị bỏ qua thay vì báo lỗi (trang chỉ đọc). */
export const auditFilterSchema = z.object({
  from: isoDate,
  to: isoDate,
  action: z.enum(AUDIT_ACTIONS).optional().catch(undefined),
  actor: z.string().trim().max(100).optional().catch(undefined),
  target: z.string().trim().max(100).optional().catch(undefined),
});
export type AuditFilter = z.infer<typeof auditFilterSchema>;

export interface AuditLogItemDto {
  id: string;
  createdAt: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  targetType: string;
  targetId: string | null;
  /** `detail` rút gọn thành các cặp khóa–giá trị dạng chữ để hiển thị. */
  detail: { key: string; value: string }[];
}

const MAX_VALUE_LENGTH = 200;

function flattenDetail(detail: Record<string, unknown> | null): { key: string; value: string }[] {
  if (!detail) return [];
  return Object.entries(detail).map(([key, v]) => {
    const text = typeof v === 'string' ? v : JSON.stringify(v);
    return {
      key,
      value: text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text,
    };
  });
}

/**
 * Nhật ký kiểm toán — CHỈ ĐỌC (append-only, docs/rules/06). Lọc theo khoảng ngày (giờ Việt Nam),
 * loại hành động, người thực hiện (mã hoặc email), đối tượng (mã tài nguyên hoặc giá trị trong
 * chi tiết, VD MSSV, mã lô). Mới nhất trước.
 */
export async function listAuditLogs(
  filter: AuditFilter,
  list: ListParams<AuditSortKey> = firstPage(AUDIT_DEFAULT_SORT),
): Promise<Paged<AuditLogItemDto>> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(AuditLog)
    .createQueryBuilder('a')
    .skip(pageOffset(list))
    .take(list.size);
  applyOrder(qb, list.sort === 'action' ? 'a.action' : 'a.createdAt', list.dir, [
    'a.createdAt',
    'DESC',
  ]);
  if (filter.from) qb.andWhere('a.createdAt >= :from', { from: vnStartOfDay(filter.from) });
  if (filter.to) qb.andWhere('a.createdAt <= :to', { to: vnEndOfDay(filter.to) });
  if (filter.action) qb.andWhere('a.action = :action', { action: filter.action });
  if (filter.actor) {
    const actor = `%${escapeLike(filter.actor)}%`;
    qb.andWhere(
      new Brackets((w) => {
        w.where('a.actorId ILIKE :actor', { actor }).orWhere(
          `a.actorId IN (SELECT u.user_id FROM users u WHERE u.email ILIKE :actor OR u.full_name ILIKE :actor)`,
        );
      }),
    );
  }
  if (filter.target) {
    const target = `%${escapeLike(filter.target)}%`;
    qb.andWhere(
      new Brackets((w) => {
        w.where('a.targetId ILIKE :target', { target }).orWhere('a.detail::text ILIKE :target');
      }),
    );
  }
  const [logs, total] = await qb.getManyAndCount();
  const actorIds = [...new Set(logs.map((l) => l.actorId).filter((id): id is string => !!id))];
  const actors =
    actorIds.length === 0
      ? []
      : await ds
          .getRepository(User)
          .createQueryBuilder('u')
          .select(['u.userId', 'u.fullName'])
          .where('u.userId IN (:...actorIds)', { actorIds })
          .getMany();
  const nameOf = new Map(actors.map((u) => [u.userId, u.fullName]));
  return {
    items: logs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      action: l.action,
      actorId: l.actorId,
      actorName: l.actorId ? (nameOf.get(l.actorId) ?? null) : null,
      targetType: l.targetType,
      targetId: l.targetId,
      detail: flattenDetail(l.detail),
    })),
    total,
    page: list.page,
    size: list.size,
  };
}

export const isAuditAction = (value: string): value is AuditAction =>
  (AUDIT_ACTIONS as readonly string[]).includes(value);
