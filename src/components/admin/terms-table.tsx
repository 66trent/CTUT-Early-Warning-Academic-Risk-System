'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { CalendarCheck, Lock } from 'lucide-react';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { formatVnDate, formatVnDateTime } from '@/lib/dates';
import { closeTermAction, setCurrentTermAction } from '@/modules/admin/actions/term.actions';
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

function TermActions({ term }: { term: TermDto }) {
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
      <ConfirmActionButton
        trigger="Chốt học kỳ"
        triggerVariant="ghost"
        destructive
        title={`Chốt ${term.termName}?`}
        description={
          <>
            Chỉ chốt sau khi đã nhập đầy đủ kết quả cuối kỳ. Sau khi chốt, học kỳ không nhận thêm dữ
            liệu điểm danh, bài kiểm tra và không chạy đánh giá mới.{' '}
            <strong>Không thể mở lại.</strong>
          </>
        }
        confirmLabel="Chốt học kỳ"
        successMessage={`Đã chốt ${term.termName}`}
        onConfirm={() => closeTermAction({ termId: term.termId })}
      />
    </div>
  );
}

const columns: ColumnDef<TermDto>[] = [
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
    cell: ({ row }) => <TermActions term={row.original} />,
  },
];

export function TermsTable({ terms }: { terms: TermDto[] }) {
  return (
    <DataTable
      columns={columns}
      data={terms}
      getRowId={(t) => t.termId}
      emptyMessage="Chưa có học kỳ nào. Tạo học kỳ đầu tiên rồi đặt làm học kỳ hiện tại."
    />
  );
}
