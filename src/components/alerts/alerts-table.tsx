'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { AlertStatusBadge } from '@/components/domain/alert-status-badge';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { Button } from '@/components/ui/button';
import { formatVnDateTime } from '@/lib/dates';
import type { SortDir } from '@/lib/list-params';
import type { AlertListItemDto } from '@/modules/alerts/services/alert-query.service';
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
}

/** Danh sách cảnh báo — bấm "Xem" mở Sheet chi tiết (URL `?alert=` để mở thẳng từ email). */
export function AlertsTable({
  items,
  emptyMessage,
  profileBase,
  showAdvisor = false,
  serverSort,
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
        meta: { sortKey: 'severity' },
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      {
        accessorKey: 'studentName',
        header: 'Sinh viên',
        meta: { sortKey: 'studentId', mobile: 'title' },
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.studentName}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {row.original.studentId} · {row.original.classId}
            </span>
          </span>
        ),
      },
      {
        accessorKey: 'summary',
        header: 'Vì sao',
        cell: ({ row }) => (
          <span className="flex flex-col gap-1">
            {row.original.summary}
            {row.original.signalsClearedAt && <SignalsClearedNote compact />}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        meta: { sortKey: 'status' },
        cell: ({ row }) => <AlertStatusBadge status={row.original.status} />,
      },
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
        meta: { sortKey: 'lastDetectedAt' },
        cell: ({ row }) => formatVnDateTime(row.original.lastDetectedAt),
      },
      {
        id: 'open',
        header: '',
        meta: { mobile: 'footer' },
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => setOpen(row.original.alertId)}>
            Xem
          </Button>
        ),
      },
    ],
    [setOpen, showAdvisor],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(a) => a.alertId}
        serverSort={serverSort}
        emptyMessage={emptyMessage}
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
