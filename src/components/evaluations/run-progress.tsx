import { EvaluationRunStatus } from '@/db/enums';

/** Tiến độ thật của 1 lần chạy (docs/rules/07) — dùng ở trang Chạy đánh giá và trang kết quả. */
export function RunProgress({
  status,
  processed,
  total,
}: {
  status: EvaluationRunStatus;
  processed: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground">
        {status === EvaluationRunStatus.QUEUED
          ? 'Đang chờ đến lượt chạy, trang tự cập nhật.'
          : `Đang chạy đánh giá: ${processed}/${total} sinh viên, trang tự cập nhật.`}
      </p>
      <div
        role="progressbar"
        aria-label="Tiến độ chạy đánh giá"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
