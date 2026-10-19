import type { Metadata } from 'next';
import { ClassesTable, CreateClassButton } from '@/components/admin/classes-view';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { HELP_LINKS } from '@/lib/help-links';
import {
  listAssignableAdvisors,
  listClasses,
  listDepartments,
} from '@/modules/admin/services/class.service';

export const metadata: Metadata = { title: 'Khoa và lớp sinh hoạt' };

export default async function ClassesPage() {
  await requireUser([UserRole.ADMIN]);
  const [departments, classes, advisors] = await Promise.all([
    listDepartments(),
    listClasses(),
    listAssignableAdvisors(),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        helpHref={HELP_LINKS.classes}
        title="Khoa và lớp sinh hoạt"
        description="Cố vấn học tập được gán theo lớp sinh hoạt và thấy sinh viên của các lớp mình phụ trách."
        action={<CreateClassButton departments={departments} advisors={advisors} />}
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Lớp sinh hoạt</CardTitle>
          {advisors.length === 0 && (
            <CardDescription>
              Chưa có Cố vấn học tập nào đang hoạt động. Duyệt tài khoản Cố vấn học tập ở mục Tài
              khoản để gán cho lớp.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <ClassesTable classes={classes} departments={departments} advisors={advisors} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Khoa</CardTitle>
          <CardDescription>Danh mục khoa chính thức của trường (chỉ xem).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã khoa</TableHead>
                  <TableHead>Tên khoa</TableHead>
                  <TableHead className="text-right">Số lớp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((d) => (
                  <TableRow key={d.departmentId} className="even:bg-muted">
                    <TableCell className="font-medium">{d.departmentId}</TableCell>
                    <TableCell>{d.departmentName}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.classCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
