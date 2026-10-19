'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { ChevronDown } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataCompletenessBadge } from '@/components/domain/data-completeness-badge';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SortDir } from '@/lib/list-params';
import type { RunStudentRowDto } from '@/modules/rule-engine/services/evaluation-query.service';

/** RiskScore thang 0–1 (người dùng chốt 2026-10-19): số 2 chữ số lẻ, dấu phẩy, kèm thanh. */
function RiskScoreBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">Chưa tính được</span>;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span className="flex items-center gap-2">
      <span className="w-9 text-right font-medium tabular-nums">
        {value.toFixed(2).replace('.', ',')}
      </span>
      <span
        aria-hidden
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        title={`${value.toFixed(2).replace('.', ',')} / 1`}
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

function Signals({ row }: { row: RunStudentRowDto }) {
  if (row.signalCount === 0) {
    return <span className="text-muted-foreground">Không có dấu hiệu</span>;
  }
  return (
    <Collapsible>
      <CollapsibleTrigger className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {row.signalCount} dấu hiệu
        <ChevronDown
          aria-hidden
          className="size-4 transition-transform group-data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 flex min-w-0 flex-col gap-2 md:min-w-80">
          {row.signals.map((s, i) => (
            <li key={`${s.ruleCode}-${s.courseId ?? ''}-${i}`} className="rounded-md border p-2">
              <span className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={s.severity} />
                <span className="font-medium tabular-nums">{s.ruleCode}</span>
                <span className="text-xs text-muted-foreground">
                  {s.ruleName} · {s.courseId ?? 'Cả học kỳ'}
                </span>
              </span>
              <span className="mt-1 block text-sm whitespace-normal">{s.reason}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

const columns: ColumnDef<RunStudentRowDto>[] = [
  {
    accessorKey: 'maxSeverity',
    header: 'Mức cao nhất',
    meta: { sortKey: 'severity' },
    cell: ({ row }) =>
      row.original.maxSeverity ? (
        <SeverityBadge severity={row.original.maxSeverity} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
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
    accessorKey: 'riskScore',
    header: 'Điểm rủi ro',
    meta: { sortKey: 'riskScore' },
    cell: ({ row }) => <RiskScoreBar value={row.original.riskScore} />,
  },
  {
    accessorKey: 'level',
    header: 'Mức dữ liệu',
    cell: ({ row }) => <DataCompletenessBadge level={row.original.level} />,
  },
  {
    accessorKey: 'signalCount',
    header: 'Dấu hiệu',
    meta: { sortKey: 'signalCount' },
    cell: ({ row }) => <Signals row={row.original} />,
  },
];

/** Kết quả lần chạy — 1 dòng / sinh viên, bấm "N dấu hiệu" xem từng luật ngay trong dòng. */
export function RunStudentsTable({
  rows,
  sort,
  emptyMessage,
}: {
  rows: RunStudentRowDto[];
  sort: { sort: string | null; dir: SortDir };
  emptyMessage: string;
}) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.studentId}
      serverSort={sort}
      emptyMessage={emptyMessage}
    />
  );
}
