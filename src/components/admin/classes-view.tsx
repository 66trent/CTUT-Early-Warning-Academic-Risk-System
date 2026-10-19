'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Building2, Pencil, Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import type { SortDir } from '@/lib/list-params';
import type {
  AdvisorOptionDto,
  ClassListItemDto,
  DepartmentDto,
} from '@/modules/admin/services/class.service';
import { ChangeAdvisorDialog } from './change-advisor-dialog';
import { ClassFormDialog } from './class-form-dialog';

interface ClassesViewProps {
  classes: ClassListItemDto[];
  departments: DepartmentDto[];
  advisors: AdvisorOptionDto[];
}

export function CreateClassButton({ departments, advisors }: Omit<ClassesViewProps, 'classes'>) {
  return (
    <ClassFormDialog
      departments={departments}
      advisors={advisors}
      trigger={
        <Button>
          <Plus aria-hidden />
          Tạo lớp
        </Button>
      }
    />
  );
}

export function ClassesTable({
  classes,
  departments,
  advisors,
  sort,
  filtered,
}: ClassesViewProps & { sort: { sort: string | null; dir: SortDir }; filtered: boolean }) {
  const columns: ColumnDef<ClassListItemDto>[] = [
    {
      accessorKey: 'classId',
      header: 'Lớp',
      meta: { sortKey: 'classId', mobile: 'title' },
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-medium tabular-nums">{row.original.classId}</span>
          <span className="text-xs text-muted-foreground">{row.original.className}</span>
        </span>
      ),
    },
    {
      accessorKey: 'cohortYear',
      header: 'Khóa',
      meta: { sortKey: 'cohortYear' },
      cell: ({ row }) => <span className="tabular-nums">{row.original.cohortYear}</span>,
    },
    {
      accessorKey: 'departmentName',
      header: 'Khoa',
      meta: { sortKey: 'departmentId' },
    },
    {
      accessorKey: 'advisorName',
      header: 'Cố vấn học tập',
      meta: { sortKey: 'advisorName' },
      cell: ({ row }) =>
        row.original.advisorName ? (
          <span className="flex flex-col">
            {row.original.advisorName}
            <span className="text-xs text-muted-foreground tabular-nums">
              {row.original.advisorId}
            </span>
          </span>
        ) : (
          <span className="font-medium text-amber-700 dark:text-amber-400">Chưa gán</span>
        ),
    },
    {
      accessorKey: 'studentCount',
      header: 'Sĩ số',
      cell: ({ row }) => <span className="tabular-nums">{row.original.studentCount}</span>,
    },
    {
      accessorKey: 'openAlerts',
      header: 'Cảnh báo đang mở',
      meta: { label: 'Cảnh báo đang mở' },
      cell: ({ row }) =>
        row.original.openAlerts === null ? (
          <span className="text-muted-foreground">—</span>
        ) : row.original.openAlerts > 0 ? (
          <span className="font-semibold text-amber-700 tabular-nums dark:text-amber-400">
            {row.original.openAlerts}
          </span>
        ) : (
          <span className="text-muted-foreground tabular-nums">0</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <ChangeAdvisorDialog classItem={row.original} advisors={advisors} />
          <ClassFormDialog
            editing={row.original}
            departments={departments}
            advisors={advisors}
            trigger={
              <Button size="sm" variant="ghost" aria-label={`Sửa lớp ${row.original.classId}`}>
                <Pencil aria-hidden />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={classes}
      getRowId={(c) => c.classId}
      serverSort={sort}
      emptyMessage={
        filtered ? (
          'Không có lớp nào khớp bộ lọc.'
        ) : (
          <EmptyState
            icon={Building2}
            title="Chưa có lớp sinh hoạt nào"
            description="Tạo lớp rồi gán Cố vấn học tập trước khi nhập danh sách sinh viên."
          />
        )
      }
    />
  );
}
