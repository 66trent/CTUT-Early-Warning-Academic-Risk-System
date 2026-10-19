'use client';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { Badge } from '@/components/ui/badge';
import type { Severity } from '@/db/enums';
import { formatVnDate } from '@/lib/dates';

export interface RuleRowView {
  ruleCode: string;
  ruleName: string;
  description: string;
  groupLabel: string;
  activeVersion: number | null;
  activeSince: string | null;
  /** null với cấu hình RiskScore (không tạo cảnh báo). */
  activeSeverity: Severity | null;
  hasDraft: boolean;
}

const columns: ColumnDef<RuleRowView>[] = [
  {
    accessorKey: 'ruleCode',
    header: 'Luật',
    meta: { mobile: 'title' },
    cell: ({ row }) => (
      <span className="flex min-w-0 flex-col whitespace-normal md:min-w-72">
        <Link
          href={`/admin/rules/${row.original.ruleCode}`}
          className="font-medium text-primary hover:underline"
        >
          <span className="tabular-nums">{row.original.ruleCode}</span> · {row.original.ruleName}
        </Link>
        <span className="text-xs font-normal text-muted-foreground">
          {row.original.description}
        </span>
      </span>
    ),
  },
  { accessorKey: 'groupLabel', header: 'Nhóm' },
  {
    accessorKey: 'activeVersion',
    header: 'Phiên bản đang áp dụng',
    meta: { label: 'Đang áp dụng' },
    cell: ({ row }) =>
      row.original.activeVersion ? (
        <span className="tabular-nums">
          v{row.original.activeVersion}
          <span className="block text-xs text-muted-foreground">
            từ {formatVnDate(row.original.activeSince ?? '')}
          </span>
        </span>
      ) : (
        '—'
      ),
  },
  {
    accessorKey: 'activeSeverity',
    header: 'Mức cao nhất',
    cell: ({ row }) =>
      row.original.activeSeverity ? <SeverityBadge severity={row.original.activeSeverity} /> : '—',
  },
  {
    id: 'draft',
    header: '',
    enableSorting: false,
    meta: { mobile: 'footer' },
    cell: ({ row }) =>
      row.original.hasDraft ? <Badge variant="outline">Có bản nháp</Badge> : null,
  },
];

/** Danh sách luật (12 luật + cấu hình RiskScore) — danh sách ngắn, sắp xếp trong trang. */
export function RulesTable({ rules }: { rules: RuleRowView[] }) {
  return (
    <DataTable
      columns={columns}
      data={rules}
      getRowId={(r) => r.ruleCode}
      emptyMessage="Chưa có luật nào — báo người cài đặt hệ thống nạp bộ luật mặc định."
    />
  );
}
