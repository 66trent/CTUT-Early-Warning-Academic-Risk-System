import { X } from 'lucide-react';
import Link from 'next/link';
import type { Severity } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';
import { type RawSearchParams, withParams } from '@/lib/list-params';
import type { AlertStatusGroup } from '@/modules/alerts/services/alert-query.service';
import { OVERDUE_DAYS } from '@/modules/alerts/services/dashboard.service';

export const STATUS_GROUP_LABELS: Record<AlertStatusGroup, string> = {
  waiting: 'Chờ xác nhận',
  following: 'Đang theo dõi',
  done: 'Đã xong hoặc bỏ qua',
  overdue: `Quá ${OVERDUE_DAYS} ngày chưa xác nhận`,
};

/** Hiện bộ lọc đang áp (từ trang tổng quan) dạng chip, mỗi chip có nút bỏ lọc. */
export function ActiveAlertFilters({
  basePath,
  params,
  extra,
}: {
  basePath: string;
  params: RawSearchParams;
  extra: { severity?: Severity; status?: AlertStatusGroup; classId?: string };
}) {
  const chips = [
    extra.severity && { key: 'severity', label: `Mức: ${SEVERITY_LABELS[extra.severity]}` },
    extra.status && { key: 'status', label: STATUS_GROUP_LABELS[extra.status] },
    extra.classId && { key: 'classId', label: `Lớp ${extra.classId}` },
  ].filter((c): c is { key: string; label: string } => !!c);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Đang lọc:</span>
      {chips.map((c) => (
        <Link
          key={c.key}
          href={`${basePath}${withParams(params, { [c.key]: null, page: null })}`}
          className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary-soft px-2.5 py-0.5 text-primary hover:bg-secondary"
          aria-label={`Bỏ lọc ${c.label}`}
        >
          {c.label}
          <X aria-hidden className="size-3.5" />
        </Link>
      ))}
      <Link
        href={`${basePath}${withParams(params, { severity: null, status: null, classId: null, page: null })}`}
        className="text-primary hover:underline"
      >
        Bỏ tất cả
      </Link>
    </div>
  );
}
