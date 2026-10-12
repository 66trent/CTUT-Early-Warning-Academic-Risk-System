import { z } from 'zod';
import { UserRole } from '@/db/enums';
import { getCurrentUser } from '@/lib/auth-server';
import { buildErrorCsv } from '@/modules/data-import/services/error-file.service';
import { UserAccountStatus } from '@/db/enums';

export const dynamic = 'force-dynamic';

/** Tải file dòng lỗi (export file — docs/rules/01). Chỉ Admin đang hoạt động. */
export async function GET(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN || user.accountStatus !== UserAccountStatus.ACTIVE) {
    return new Response('Không có quyền.', { status: 403 });
  }
  const parsed = z.uuid().safeParse((await context.params).batchId);
  if (!parsed.success) return new Response('Không tìm thấy.', { status: 404 });

  const csv = await buildErrorCsv(parsed.data);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="dong-loi-${parsed.data.slice(0, 8)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
