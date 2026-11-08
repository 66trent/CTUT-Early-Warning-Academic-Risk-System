'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { SearchX, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { AlertStatusBadge } from '@/components/domain/alert-status-badge';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/ui/input';
import type { AlertStatus, Severity } from '@/db/enums';

export interface AdvisorStudentRow {
  studentId: string;
  fullName: string;
  classId: string;
  severity: Severity | null;
  status: AlertStatus | null;
}

const fold = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

/** Danh sách sinh viên của Cố vấn học tập, mức cao lên đầu; tìm theo MSSV hoặc họ tên, gõ không dấu được. */
export function AdvisorStudentsTable({
  students,
  termId,
}: {
  students: AdvisorStudentRow[];
  termId: string | null;
}) {
  const [query, setQuery] = useState('');
  const columns = useMemo<ColumnDef<AdvisorStudentRow>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Sinh viên',
        meta: { mobile: 'title' },
        cell: ({ row }) => (
          <>
            <Link
              href={`/advisor/students/${row.original.studentId}?term=${termId ?? ''}`}
              className="font-medium text-primary hover:underline"
            >
              {row.original.fullName}
            </Link>
            <span className="block text-xs text-muted-foreground tabular-nums">
              {row.original.studentId}
            </span>
          </>
        ),
      },
      { accessorKey: 'classId', header: 'Lớp', meta: { mobile: 'hide' } },
      {
        accessorKey: 'severity',
        header: 'Cảnh báo học kỳ',
        meta: { mobile: 'plain' },
        cell: ({ row }) =>
          row.original.severity && row.original.status ? (
            <span className="flex flex-wrap gap-2">
              <SeverityBadge severity={row.original.severity} />
              <AlertStatusBadge status={row.original.status} />
            </span>
          ) : (
            <span className="text-muted-foreground">Không có cảnh báo</span>
          ),
      },
    ],
    [termId],
  );

  const needle = fold(query.trim());
  const shown = needle
    ? students.filter((s) => fold(`${s.studentId} ${s.fullName}`).includes(needle))
    : students;

  return (
    <div className="flex flex-col gap-4">
      {students.length > 0 && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="MSSV hoặc họ tên"
          aria-label="Tìm sinh viên phụ trách"
          className="w-full sm:w-72"
        />
      )}
      <DataTable
        columns={columns}
        data={shown}
        getRowId={(s) => s.studentId}
        emptyMessage={
          students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Bạn chưa được phân công lớp sinh hoạt nào"
              description="Quản trị viên sẽ gán lớp cho bạn ở trang Khoa và lớp sinh hoạt."
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy sinh viên phù hợp"
              description="Thử gõ một phần mã số hoặc họ tên."
            />
          )
        }
      />
    </div>
  );
}
