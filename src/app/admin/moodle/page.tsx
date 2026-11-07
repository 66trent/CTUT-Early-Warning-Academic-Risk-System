import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleAlert, CircleCheck, PlugZap } from 'lucide-react';
import { CourseLinkTable } from '@/components/moodle/course-link-table';
import { SyncPanel } from '@/components/moodle/sync-panel';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { type RawSearchParams } from '@/lib/list-params';
import { cn } from '@/lib/utils';
import { getImportFormOptions } from '@/modules/data-import/services/import-query.service';
import {
  describeMoodleError,
  getMoodleConnection,
  listMoodleCourseRows,
  type MoodleCourseRowDto,
} from '@/modules/data-import/services/moodle-link.service';
import { listMoodleSyncRuns } from '@/modules/data-import/services/moodle-sync.service';

export const metadata: Metadata = { title: 'Kết nối Moodle' };

/**
 * Kết nối Moodle (Phase 10b — docs/tich-hop-moodle.md, docs/huong-dan-moodle.md): trạng thái web
 * service chỉ đọc, bật khóa học Moodle cho 1 học kỳ, "Đồng bộ ngay" → 3 lô chờ "Xác nhận nạp cả 3".
 */
export default async function MoodlePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const { terms } = await getImportFormOptions();
  const requested = typeof params.term === 'string' ? params.term : null;
  const term =
    terms.find((t) => t.termId === requested) ?? terms.find((t) => t.isCurrent) ?? terms[0] ?? null;
  const connection = await getMoodleConnection();

  let rows: MoodleCourseRowDto[] = [];
  let listError: string | null = null;
  if (term && connection.ok) {
    try {
      rows = await listMoodleCourseRows(term.termId);
    } catch (error) {
      listError = describeMoodleError(error);
    }
  }
  const runs = term ? await listMoodleSyncRuns(term.termId) : [];
  const enabled = rows.filter((r) => r.link?.enabled).length;
  const syncHint = !connection.ok
    ? 'Cần kết nối được Moodle.'
    : enabled === 0
      ? 'Bật ít nhất 1 khóa học ở bảng bên dưới.'
      : `${enabled} khóa học đang bật — đọc điểm danh, trắc nghiệm, thực hành rồi chờ bạn xác nhận.`;
  const connectionText = connection.ok
    ? `${connection.siteName ?? ''} — Moodle ${connection.release ?? ''} · tài khoản ${connection.username ?? ''} · ${connection.functionCount} hàm chỉ đọc được cấp · ${connection.baseUrl ?? ''}`
    : connection.configured
      ? (connection.error ?? 'Lỗi không xác định.')
      : 'Đặt MOODLE_BASE_URL và MOODLE_WS_TOKEN (token web service chỉ đọc) trong biến môi trường rồi khởi động lại. Moodle demo: npm run moodle:up rồi npm run moodle:setup (docs/huong-dan-moodle.md).';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Kết nối Moodle"
        description="Đồng bộ chỉ đọc điểm danh, bài trắc nghiệm, bài thực hành từ Moodle. Kết quả học phần vẫn nạp file."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {connection.ok ? (
              <CircleCheck className="text-primary" aria-hidden />
            ) : (
              <CircleAlert className="text-destructive" aria-hidden />
            )}
            {connection.ok
              ? 'Đã kết nối'
              : connection.configured
                ? 'Không kết nối được'
                : 'Chưa cấu hình'}
          </CardTitle>
          <CardDescription className="break-words">{connectionText}</CardDescription>
        </CardHeader>
      </Card>

      {!term ? (
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <PlugZap aria-hidden />
            Chưa có học kỳ đang mở — tạo học kỳ ở trang Học kỳ trước.
          </CardContent>
        </Card>
      ) : (
        <>
          <nav aria-label="Chọn học kỳ" className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <Link
                key={t.termId}
                href={`/admin/moodle?term=${t.termId}`}
                aria-current={t.termId === term.termId ? 'page' : undefined}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  t.termId === term.termId
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'hover:bg-muted',
                )}
              >
                {t.termName}
                {t.isCurrent ? ' (hiện tại)' : ''}
              </Link>
            ))}
          </nav>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Đồng bộ — {term.termName}</CardTitle>
              <CardDescription>
                Chạy tay: mỗi lần đồng bộ tạo tối đa 3 lô (điểm danh / trắc nghiệm / thực hành, mỗi
                khóa 1 file). Dữ liệu chỉ được ghi sau khi bạn bấm Xác nhận. Sinh viên Moodle chưa
                có trong EWARS được bỏ qua và đếm riêng.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SyncPanel
                termId={term.termId}
                runs={runs}
                canSync={connection.ok && enabled > 0}
                syncHint={syncHint}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Khóa học trên Moodle</CardTitle>
              <CardDescription>
                Chỉ khóa có Course ID number là mã lớp học phần 12 chữ số mới bật được. Điểm danh
                quy đổi thời lượng buổi học ra tiết (1 tiết = 50 phút).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {listError ? (
                <p className="text-destructive">{listError}</p>
              ) : connection.ok ? (
                <CourseLinkTable termId={term.termId} rows={rows} canEdit />
              ) : (
                <p className="text-muted-foreground">Kết nối Moodle để xem danh sách khóa học.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
