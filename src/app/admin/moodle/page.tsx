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
import { formatVnDateTime } from '@/lib/dates';
import { getEnv } from '@/lib/env';
import { cn } from '@/lib/utils';
import { getImportFormOptions } from '@/modules/data-import/services/import-query.service';
import {
  describeMoodleError,
  getMoodleConnection,
  listMoodleCourseRows,
  type MoodleCourseRowDto,
} from '@/modules/data-import/services/moodle-link.service';
import {
  getMoodleAutoStatus,
  type MoodleAutoStatusDto,
} from '@/modules/data-import/services/moodle-auto.service';
import { listMoodleSyncRuns } from '@/modules/data-import/services/moodle-sync.service';

export const metadata: Metadata = { title: 'Kết nối Moodle' };

/**
 * Kết nối Moodle (Phase 10b–10c — docs/tich-hop-moodle.md, docs/huong-dan-moodle.md): trạng thái web
 * service chỉ đọc, bật khóa học Moodle cho 1 học kỳ, chế độ Chạy tay ("Đồng bộ ngay" → 3 lô chờ "Xác
 * nhận nạp cả 3") / Tự động (sự kiện, dò định kỳ, mỗi đêm, hạn nộp → tự nạp + tự đánh giá).
 */
function AutoStatus({ status }: { status: MoodleAutoStatusDto }) {
  const events = status.webhookConfigured
    ? status.lastEventAt
      ? `Sự kiện Moodle gần nhất: ${formatVnDateTime(status.lastEventAt)} · ${status.eventsLast24h} sự kiện trong 24 giờ`
      : 'Chưa nhận sự kiện nào từ Moodle (plugin local_ewars).'
    : 'Chưa bật nhận sự kiện từ Moodle, hệ thống chỉ dò thay đổi định kỳ.';
  const checked = status.lastCheckedAt
    ? `Dò thay đổi gần nhất: ${formatVnDateTime(status.lastCheckedAt)}`
    : 'Chưa dò thay đổi lần nào.';
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-dashed p-3 text-sm">
      <span className="font-medium">Tự động: {status.autoCourses} khóa học</span>
      <span className="text-muted-foreground">{events}</span>
      <span className="text-muted-foreground">
        {checked} · Mỗi đêm đồng bộ đầy đủ; đến hạn nộp bài tự đánh giá lại.
      </span>
    </div>
  );
}

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
  const runs = term ? await listMoodleSyncRuns(term.termId, 10) : [];
  const auto = term
    ? await getMoodleAutoStatus(term.termId, Boolean(getEnv().MOODLE_WEBHOOK_SECRET))
    : null;
  const enabled = rows.filter((r) => r.link?.enabled).length;
  const syncHint = !connection.ok
    ? 'Cần kết nối được Moodle.'
    : enabled === 0
      ? 'Bật ít nhất 1 khóa học ở bảng bên dưới.'
      : `${enabled} khóa học đang bật, khóa Thủ công chờ bạn xác nhận, khóa Tự động nhập luôn.`;
  const connectionText = connection.ok
    ? `${connection.siteName ?? ''} · Moodle ${connection.release ?? ''} · tài khoản ${connection.username ?? ''} · ${connection.functionCount} hàm chỉ đọc được cấp · ${connection.baseUrl ?? ''}`
    : connection.configured
      ? (connection.error ?? 'Lỗi không xác định.')
      : 'Hệ thống chưa được khai báo địa chỉ Moodle và khóa truy cập chỉ đọc. Người quản trị máy chủ cần khai báo rồi khởi động lại hệ thống.';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kết nối Moodle"
        description="Đồng bộ chỉ đọc điểm danh, bài trắc nghiệm, bài thực hành từ Moodle. Kết quả học phần vẫn nhập file."
      />

      <Card
        className={cn(
          'shadow-sm',
          !connection.ok &&
            (connection.configured
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'),
        )}
      >
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
            Chưa có học kỳ đang mở, tạo học kỳ ở trang Học kỳ trước.
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
              <CardTitle>Đồng bộ · {term.termName}</CardTitle>
              <CardDescription>
                Thủ công: dữ liệu chỉ được ghi sau khi bạn bấm Xác nhận. Tự động: Moodle có thay đổi
                là hệ thống tự nhập và tự chạy đánh giá.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {auto && auto.autoCourses > 0 && <AutoStatus status={auto} />}
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
                Chỉ khóa có mã lớp học phần 12 chữ số (ô Course ID number trên Moodle) mới bật được.
                Điểm danh quy đổi thời lượng buổi học ra tiết (1 tiết = 50 phút).
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
