'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { AlertStatusBadge } from '@/components/domain/alert-status-badge';
import { SEVERITY_ROW_CLASS, SeverityBadge } from '@/components/domain/severity-badge';
import { AlertStatus } from '@/db/enums';
import { formatVnDateTime } from '@/lib/dates';
import { SEVERITY_LABELS } from '@/lib/labels';
import type { SortDir } from '@/lib/list-params';
import { cn } from '@/lib/utils';
import type { AlertListItemDto } from '@/modules/alerts/services/alert-query.service';
import { OVERDUE_DAYS } from '@/modules/alerts/services/alert-presentation';
import { AlertSheet } from './alert-sheet';
import { SignalsClearedNote } from './signals-cleared-note';

interface AlertsTableProps {
  items: AlertListItemDto[];
  emptyMessage: ReactNode;
  profileBase: string;
  /** Admin: thêm cột Cố vấn học tập phụ trách. */
  showAdvisor?: boolean;
  /** Danh sách có phân trang: sắp xếp phía server theo URL. */
  serverSort?: { sort: string | null; dir: SortDir };
  /** Tab "Cần xử lý": mọi dòng đều chờ xác nhận nên bỏ cột Trạng thái, chỉ gắn nhãn "Mở lại". */
  hideStatus?: boolean;
}

/** Danh sách cảnh báo — bấm dòng mở Sheet chi tiết (URL `?alert=` để mở thẳng từ email). */
export function AlertsTable({
  items,
  emptyMessage,
  profileBase,
  showAdvisor = false,
  serverSort,
  hideStatus = false,
}: AlertsTableProps) {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get('alert');

  const setOpen = useCallback(
    (alertId: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (alertId) next.set('alert', alertId);
      else next.delete('alert');
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const closeSheet = useCallback(() => setOpen(null), [setOpen]);

  const columns = useMemo<ColumnDef<AlertListItemDto>[]>(
    () => [
      {
        accessorKey: 'severity',
        header: 'Mức',
        meta: { sortKey: 'severity', mobile: 'lead' },
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      {
        accessorKey: 'studentName',
        header: 'Sinh viên',
        meta: { sortKey: 'studentId', mobile: 'title' },
        cell: ({ row }) => (
          <span className="flex flex-col items-start">
            {/* Nút cho bàn phím và trình đọc màn hình; chuột bấm cả dòng. */}
            <button
              type="button"
              className="text-left font-medium hover:text-primary hover:underline"
              aria-label={`Xem cảnh báo của ${row.original.studentName}`}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(row.original.alertId);
              }}
            >
              {row.original.studentName}
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {row.original.studentId} · {row.original.classId}
            </span>
          </span>
        ),
      },
      {
        accessorKey: 'summary',
        header: 'Vì sao',
        meta: { mobile: 'plain' },
        cell: ({ row }) => (
          <span className="flex flex-col gap-1">
            <span
              className={cn(
                'line-clamp-2 whitespace-normal md:min-w-64',
                row.original.signalsClearedAt && 'text-muted-foreground',
              )}
            >
              {row.original.summary}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {hideStatus && row.original.status === AlertStatus.REOPENED && (
                <AlertStatusBadge status={row.original.status} />
              )}
              {row.original.overdue && (
                <span className="w-fit rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  Quá {OVERDUE_DAYS} ngày chưa xác nhận
                </span>
              )}
              {row.original.signalsClearedAt && <SignalsClearedNote compact />}
            </span>
          </span>
        ),
      },
      ...(hideStatus
        ? []
        : [
            {
              accessorKey: 'status',
              header: 'Trạng thái',
              meta: { sortKey: 'status' },
              cell: ({ row }) => <AlertStatusBadge status={row.original.status} />,
            } satisfies ColumnDef<AlertListItemDto>,
          ]),
      ...(showAdvisor
        ? [
            {
              accessorKey: 'advisorName',
              header: 'Cố vấn học tập',
              cell: ({ row }) => row.original.advisorName ?? 'Chưa có',
            } satisfies ColumnDef<AlertListItemDto>,
          ]
        : []),
      {
        accessorKey: 'lastDetectedAt',
        header: 'Cập nhật',
        meta: { sortKey: 'lastDetectedAt', mobile: 'hide' },
        cell: ({ row }) => formatVnDateTime(row.original.lastDetectedAt),
      },
      {
        id: 'open',
        header: '',
        meta: { mobile: 'hide' },
        cell: () => <ChevronRight aria-hidden className="size-4 text-muted-foreground" />,
      },
    ],
    [hideStatus, setOpen, showAdvisor],
  );

  // Chỉ gom theo mức khi danh sách đang sắp theo mức (mặc định), nếu không tiêu đề nhóm lặp lung tung.
  const groupedBySeverity = !serverSort || !serverSort.sort || serverSort.sort === 'severity';

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(a) => a.alertId}
        serverSort={serverSort}
        emptyMessage={emptyMessage}
        rowClassName={(a) => SEVERITY_ROW_CLASS[a.severity]}
        onRowClick={(a) => setOpen(a.alertId)}
        groupLabel={groupedBySeverity ? (a) => SEVERITY_LABELS[a.severity] : undefined}
      />
      <AlertSheet
        key={openId ?? 'closed'}
        alertId={openId}
        profileBase={profileBase}
        onClose={closeSheet}
      />
    </>
  );
}
