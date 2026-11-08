'use client';

import { CircleAlert, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { AutoRefresh } from '@/components/imports/batch-actions';
import { BatchStatusBadge } from '@/components/imports/batch-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImportBatchStatus } from '@/db/enums';
import { formatVnDateTime } from '@/lib/dates';
import { toast } from '@/lib/notify';
import {
  confirmMoodleSyncAction,
  discardMoodleSyncAction,
  requestMoodleSyncAction,
} from '@/modules/data-import/actions/moodle.actions';
import type { MoodleSyncRunDto } from '@/modules/data-import/services/moodle-sync.service';

const TYPE_LABELS: Record<MoodleSyncRunDto['batches'][number]['dataType'], string> = {
  ATTENDANCE_SUMMARY: 'Điểm danh',
  LMS_QUIZ: 'Bài trắc nghiệm',
  LMS_ASSIGNMENT: 'Bài thực hành',
};

const TRIGGER_LABELS: Record<MoodleSyncRunDto['trigger'], string> = {
  MANUAL: 'Admin bấm Đồng bộ ngay',
  EVENT: 'Sự kiện từ Moodle',
  SCHEDULED: 'Dò thay đổi định kỳ',
  NIGHTLY: 'Đồng bộ đầy đủ mỗi đêm',
  DUE_DATE: 'Hết hạn nộp bài',
};

/** Nhãn lần đồng bộ — suy từ trạng thái các lô (đã xác nhận / đã hủy / còn chờ). */
function runLabel(run: MoodleSyncRunDto): string {
  if (run.needsReview) return 'Cần Admin xem (lỗi > 10%)';
  if (run.status === 'QUEUED') return 'Đang chờ';
  if (run.status === 'RUNNING') return 'Đang đọc Moodle';
  if (run.status === 'NO_CHANGE') return 'Không có thay đổi';
  if (run.status === 'FAILED') return 'Lỗi';
  if (
    run.batches.some(
      (b) => b.status === ImportBatchStatus.UPLOADING || b.status === ImportBatchStatus.VALIDATING,
    )
  ) {
    return 'Đang kiểm tra dữ liệu';
  }
  if (run.canConfirm) return 'Chờ xác nhận';
  if (run.batches.every((b) => b.status === ImportBatchStatus.DISCARDED)) return 'Đã hủy';
  if (run.busy) return 'Đang nhập';
  return run.mode === 'AUTO' ? 'Đã tự nhập' : 'Đã nhập';
}

function SyncNowButton({ termId, disabled }: { termId: string; disabled: boolean }) {
  const [pending, setPending] = useState(false);
  async function sync() {
    setPending(true);
    const result = await requestMoodleSyncAction({ termId });
    setPending(false);
    if (result.ok) toast.success('Đã bắt đầu đồng bộ, trang tự cập nhật khi xong.');
    else toast.error(result.message);
  }
  return (
    <Button onClick={() => void sync()} disabled={disabled || pending}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      Đồng bộ ngay
    </Button>
  );
}

function LatestRun({ run }: { run: MoodleSyncRunDto }) {
  // Chỉ nguồn đang chờ xác nhận mới được nhập; nguồn bị từ chối không tính vào nút.
  const confirmable = run.batches.filter((b) => b.status === ImportBatchStatus.STAGED);
  const total = confirmable.reduce((sum, b) => sum + b.successRows, 0);
  const unchanged = Object.values(run.unchangedFiles).reduce((sum, n) => sum + (n ?? 0), 0);
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <AutoRefresh active={run.busy} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{formatVnDateTime(run.createdAt)}</span>
        <Badge variant="outline" className="gap-1">
          {run.busy && <Loader2 className="animate-spin" aria-hidden />}
          {runLabel(run)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {run.mode === 'AUTO' ? 'Tự động' : 'Thủ công'} · {TRIGGER_LABELS[run.trigger]}
        </span>
      </div>
      {run.needsReview && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Đợt nhập có hơn 10% dòng lỗi nên hệ thống không tự nhập. Xem dòng lỗi ở từng đợt nhập rồi
          Xác nhận (nhập dòng hợp lệ) hoặc Hủy.
        </p>
      )}
      {run.errorMessage && (
        <p className="flex items-start gap-2 text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {run.errorMessage}
        </p>
      )}
      {run.batches.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-3">
          {run.batches.map((b) => (
            <li key={b.batchId} className="flex flex-col gap-1 rounded-md bg-muted p-3">
              <Link href={`/admin/imports/${b.batchId}`} className="font-medium hover:underline">
                {TYPE_LABELS[b.dataType]}
              </Link>
              <BatchStatusBadge status={b.status} />
              <span className="text-sm text-muted-foreground">
                {b.fileCount} file · {b.successRows} dòng hợp lệ
                {b.errorRows > 0 ? ` · ${b.errorRows} dòng lỗi` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {unchanged > 0 && (
        <p className="text-sm text-muted-foreground">
          {unchanged} file không đổi so với lần nhập trước, bỏ qua.
        </p>
      )}
      {run.courses.some((c) => c.error || c.notes.length > 0 || c.unknownStudents > 0) && (
        <ul className="flex flex-col gap-1 text-sm">
          {run.courses.map((c) => (
            <li key={c.linkId} className={c.error ? 'text-destructive' : 'text-muted-foreground'}>
              <span className="font-mono">{c.sectionCode}</span>:{' '}
              {c.error ??
                [
                  `${c.rows.attendance} dòng điểm danh, ${c.rows.quiz} trắc nghiệm, ${c.rows.assignment} thực hành`,
                  c.unknownStudents > 0
                    ? `${c.unknownStudents} sinh viên chưa có trong EWARS (bỏ qua)`
                    : '',
                  ...c.notes,
                ]
                  .filter(Boolean)
                  .join(' · ')}
            </li>
          ))}
        </ul>
      )}
      {(run.canConfirm || run.canDiscard) && (
        <div className="flex flex-wrap gap-2">
          {run.canConfirm && (
            <ConfirmActionButton
              trigger={`Xác nhận nhập ${confirmable.length} nguồn (${total} dòng)`}
              triggerVariant="default"
              title={`Nhập ${total} dòng từ Moodle?`}
              description="Hệ thống kiểm tra lại toàn bộ rồi ghi dữ liệu. Dòng lỗi (nếu có) không được nhập, xem chi tiết ở từng đợt nhập."
              confirmLabel="Nhập dữ liệu"
              successMessage="Đã xác nhận, hệ thống đang nhập dữ liệu."
              onConfirm={() => confirmMoodleSyncAction({ runId: run.id })}
            />
          )}
          {run.canDiscard && (
            <ConfirmActionButton
              trigger="Hủy"
              triggerVariant="ghost"
              destructive
              title="Hủy lần đồng bộ này?"
              description="Không có dữ liệu nào được ghi. Bấm Đồng bộ ngay để đọc lại từ Moodle."
              confirmLabel="Hủy"
              successMessage="Đã hủy lần đồng bộ."
              onConfirm={() => discardMoodleSyncAction({ runId: run.id })}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function SyncPanel({
  termId,
  runs,
  canSync,
  syncHint,
}: {
  termId: string;
  runs: MoodleSyncRunDto[];
  canSync: boolean;
  syncHint: string | null;
}) {
  const latest = runs[0];
  // Lần chờ xác nhận luôn hiện đủ, kể cả khi các lần tự động mới hơn đẩy nó xuống.
  const featured = runs.filter((r, i) => i === 0 || r.canConfirm || r.canDiscard);
  const older = runs.filter((r) => !featured.includes(r));
  const manualBusy = runs.some((r) => r.mode === 'MANUAL' && r.busy);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SyncNowButton termId={termId} disabled={!canSync || manualBusy} />
        {syncHint && <span className="text-sm text-muted-foreground">{syncHint}</span>}
      </div>
      {latest ? (
        featured.map((run) => <LatestRun key={run.id} run={run} />)
      ) : (
        <p className="text-sm text-muted-foreground">Chưa đồng bộ lần nào cho học kỳ này.</p>
      )}
      {older.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Các lần trước</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {older.map((run) => (
              <li key={run.id}>
                {formatVnDateTime(run.createdAt)} — {runLabel(run)} · {TRIGGER_LABELS[run.trigger]}
                {run.batches.length > 0
                  ? ` (${run.batches.map((b) => `${TYPE_LABELS[b.dataType]} ${b.successRows}`).join(', ')})`
                  : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
