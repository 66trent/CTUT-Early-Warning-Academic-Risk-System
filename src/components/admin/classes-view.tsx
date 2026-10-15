'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import type {
  AdvisorOptionDto,
  ClassDto,
  DepartmentDto,
} from '@/modules/admin/services/class.service';
import { ChangeAdvisorDialog } from './change-advisor-dialog';
import { ClassFormDialog } from './class-form-dialog';

interface ClassesViewProps {
  classes: ClassDto[];
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

export function ClassesTable({ classes, departments, advisors }: ClassesViewProps) {
  const columns: ColumnDef<ClassDto>[] = [
    { accessorKey: 'classId', header: 'Mã lớp' },
    { accessorKey: 'className', header: 'Tên lớp' },
    { accessorKey: 'departmentName', header: 'Khoa' },
    { accessorKey: 'cohortYear', header: 'Khóa' },
    {
      accessorKey: 'studentCount',
      header: 'Sĩ số',
      cell: ({ row }) => <span className="tabular-nums">{row.original.studentCount}</span>,
    },
    {
      accessorKey: 'advisorName',
      header: 'Cố vấn học tập',
      cell: ({ row }) =>
        row.original.advisorName ? (
          `${row.original.advisorName} (${row.original.advisorId})`
        ) : (
          <span className="text-muted-foreground">Chưa gán</span>
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
      emptyMessage="Chưa có lớp sinh hoạt nào. Tạo lớp rồi gán Cố vấn học tập trước khi nhập danh sách sinh viên."
    />
  );
}
