'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { AUDIT_ACTION_LABELS } from '@/lib/audit-labels';
import { formatVnDateTime } from '@/lib/dates';
import type { SortDir } from '@/lib/list-params';
import type { AuditLogItemDto } from '@/modules/admin/services/audit-log.service';

const actionLabel = (action: string) =>
  (AUDIT_ACTION_LABELS as Record<string, string | undefined>)[action] ?? action;

const columns: ColumnDef<AuditLogItemDto>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Thời điểm',
    meta: { sortKey: 'createdAt' },
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {formatVnDateTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Hành động',
    meta: { sortKey: 'action', mobile: 'title' },
    cell: ({ row }) => <span className="font-medium">{actionLabel(row.original.action)}</span>,
  },
  {
    accessorKey: 'actorId',
    header: 'Người thực hiện',
    cell: ({ row }) =>
      row.original.actorId ? (
        <>
          {row.original.actorName ?? row.original.actorId}
          <span className="block text-xs text-muted-foreground tabular-nums">
            {row.original.actorId}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">Không xác định</span>
      ),
  },
  {
    accessorKey: 'targetType',
    header: 'Đối tượng',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.targetType}
        {row.original.targetId && (
          <span className="block max-w-48 truncate text-xs text-muted-foreground">
            {row.original.targetId}
          </span>
        )}
      </span>
    ),
  },
  {
    id: 'detail',
    header: 'Chi tiết',
    cell: ({ row }) => (
      <div className="min-w-0 text-xs whitespace-normal md:min-w-64">
        {row.original.detail.length === 0
          ? '—'
          : row.original.detail.map((d) => (
              <span key={d.key} className="block break-all">
                <span className="text-muted-foreground">{d.key}:</span> {d.value}
              </span>
            ))}
      </div>
    ),
  },
];

export function AuditLogsTable({
  items,
  sort,
}: {
  items: AuditLogItemDto[];
  sort: { sort: string | null; dir: SortDir };
}) {
  return (
    <DataTable
      columns={columns}
      data={items}
      getRowId={(l) => l.id}
      serverSort={sort}
      emptyMessage="Không có bản ghi phù hợp bộ lọc. Thử nới khoảng ngày hoặc bỏ bớt điều kiện."
    />
  );
}
