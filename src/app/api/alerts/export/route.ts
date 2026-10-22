import { UserAccountStatus, UserRole } from '@/db/enums';
import { getCurrentUser } from '@/lib/auth-server';
import { logger } from '@/lib/logger';
import { exportAlerts } from '@/modules/alerts/services/alert-export.service';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { alertExtraFilterSchema } from '@/modules/alerts/validators/alert-list';

export const dynamic = 'force-dynamic';

/**
 * Xuất danh sách cảnh báo theo bộ lọc đang chọn (export file — docs/rules/01). Phạm vi kiểm ở
 * server: Cố vấn học tập chỉ lớp mình phụ trách, Admin toàn bộ (chỉ đọc) — docs/rules/06.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (
    !user ||
    user.accountStatus !== UserAccountStatus.ACTIVE ||
    (user.role !== UserRole.ADMIN && user.role !== UserRole.ADVISOR)
  ) {
    return new Response('Không có quyền.', { status: 403 });
  }
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const term = pickTerm(await listTermOptions(), query.term);
  if (!term) return new Response('Chưa có học kỳ.', { status: 404 });
  const extra = alertExtraFilterSchema.parse(query);
  const format = query.format === 'csv' ? 'csv' : 'xlsx';
  try {
    const file = await exportAlerts(
      user.role === UserRole.ADVISOR
        ? {
            role: UserRole.ADVISOR,
            userId: user.userId,
            view: query.view === 'all' ? 'ALL' : 'TODO',
          }
        : {
            role: UserRole.ADMIN,
            userId: user.userId,
            departmentId: query.department || null,
            majorId: query.major || null,
            noAdvisor: query.filter === 'no-advisor',
          },
      term.termId,
      extra,
      format,
    );
    return new Response(typeof file.body === 'string' ? file.body : new Uint8Array(file.body), {
      headers: {
        'content-type': file.contentType,
        'content-disposition': `attachment; filename="${file.fileName}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    logger.error({ err: String(error) }, 'Xuất danh sách cảnh báo lỗi');
    return new Response('Không xuất được file, vui lòng thử lại.', { status: 500 });
  }
}
