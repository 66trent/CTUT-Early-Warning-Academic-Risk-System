'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { CalendarCheck, CalendarRange, Lock } from 'lucide-react';
import { CloseTermDialog } from '@/components/admin/close-term-dialog';
import { EmptyState } from '@/components/empty-state';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { formatVnDate, formatVnDateTime } from '@/lib/dates';
import { setCurrentTermAction } from '@/modules/admin/actions/term.actions';
import type { TermDto } from '@/modules/admin/services/term.service';

function TermStatus({ term }: { term: TermDto }) {
  if (term.closedAt) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Lock aria-hidden />
        Đã chốt {formatVnDateTime(term.closedAt)}
      </Badge>
    );
  }
  if (term.isCurrent) {
    return (
      <Badge variant="unstyled" className="gap-1 border-transparent bg-primary-soft text-primary">
        <CalendarCheck aria-hidden />
        Hiện tại
      </Badge>
    );
  }
  return <span className="text-muted-foreground">Đang mở</span>;
}

function TermActions({ term, canChooseAsOf }: { term: TermDto; canChooseAsOf: boolean }) {
  if (term.closedAt) return null;
  return (
    <div className="flex justify-end gap-2">
      {!term.isCurrent && (
        <ConfirmActionButton
          trigger="Đặt làm hiện tại"
          title={`Đặt ${term.termName} làm học kỳ hiện tại?`}
          description="Các danh sách theo học kỳ và màn hình nhập dữ liệu sẽ mặc định dùng học kỳ này."
          confirmLabel="Đặt làm hiện tại"
          successMessage={`${term.termName} là học kỳ hiện tại`}
          onConfirm={() => setCurrentTermAction({ termId: term.termId })}
        />
      )}
      <CloseTermDialog
        termId={term.termId}
        termName={term.termName}
        canChooseAsOf={canChooseAsOf}
      />
    </div>
  );
}

function buildColumns(canChooseAsOf: boolean): ColumnDef<TermDto>[] {
  return [
    { accessorKey: 'termId', header: 'Mã' },
    { accessorKey: 'termName', header: 'Học kỳ' },
    {
      accessorKey: 'startDate',
      header: 'Thời gian',
      cell: ({ row }) =>
        `${formatVnDate(row.original.startDate)} – ${formatVnDate(row.original.endDate)}`,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      enableSorting: false,
      cell: ({ row }) => <TermStatus term={row.original} />,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => <TermActions term={row.original} canChooseAsOf={canChooseAsOf} />,
    },
  ];
}

export function TermsTable({ terms, canChooseAsOf }: { terms: TermDto[]; canChooseAsOf: boolean }) {
  return (
    <DataTable
      columns={buildColumns(canChooseAsOf)}
      data={terms}
      getRowId={(t) => t.termId}
      emptyMessage={
        <EmptyState
          icon={CalendarRange}
          title="Chưa có học kỳ nào"
          description="Bấm Tạo học kỳ ở góc trên, rồi đặt học kỳ đó làm học kỳ hiện tại để bắt đầu nạp dữ liệu."
        />
      }
    />
  );
}
