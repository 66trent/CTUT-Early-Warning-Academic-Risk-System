'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { AUDIT_ACTION_LABELS, AUDIT_TARGET_LABELS, presentAuditDetail } from '@/lib/audit-labels';
import { formatVnDateTime } from '@/lib/dates';
import type { SortDir } from '@/lib/list-params';
import type { AuditLogItemDto } from '@/modules/admin/services/audit-log.service';

const actionLabel = (action: string) =>
  (AUDIT_ACTION_LABELS as Record<string, string | undefined>)[action] ?? action;

/** Phần đọc được hiện ngay; mã lỗi, JSON gấp lại vì chỉ cần khi tra cứu. */
function AuditDetail({ detail }: { detail: AuditLogItemDto['detail'] }) {
  const { rows, technical } = presentAuditDetail(detail);
  if (rows.length === 0 && technical.length === 0) return '—';
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-sm whitespace-normal md:min-w-64">
      {rows.map((r) => (
        <span key={r.label}>
          <span className="text-muted-foreground">{r.label}:</span> {r.value}
        </span>
      ))}
      {technical.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            Thông tin kỹ thuật
          </summary>
          {technical.map((d) => (
            <span key={d.key} className="block font-mono break-all">
              {d.key}: {d.value}
            </span>
          ))}
        </details>
      )}
    </div>
  );
}

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
        {AUDIT_TARGET_LABELS[row.original.targetType] ?? row.original.targetType}
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
    cell: ({ row }) => <AuditDetail detail={row.original.detail} />,
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
