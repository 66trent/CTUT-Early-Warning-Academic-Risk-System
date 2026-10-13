import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { OFFICIAL_STATUS_LABELS } from '@/lib/labels';
import {
  searchStudents,
  STUDENTS_PAGE_SIZE,
} from '@/modules/admin/services/student-search.service';

export const metadata: Metadata = { title: 'Sinh viên' };

/** Admin tìm sinh viên để xem hồ sơ (chỉ đọc) và đánh dấu rút học phần. */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const q = (params.q ?? '').slice(0, 100);
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total } = await searchStudents(q, page);
  const lastPage = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));
  const pageHref = (p: number) =>
    `/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString()}`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Sinh viên"
        description="Tìm sinh viên để xem hồ sơ học tập (chỉ đọc) và đánh dấu rút học phần. Mỗi lần xem hồ sơ được ghi vào nhật ký hệ thống."
      />
      <form className="flex flex-wrap gap-2" action="/admin/students">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Mã số hoặc họ tên sinh viên"
          aria-label="Tìm sinh viên"
          className="w-80 max-w-full"
        />
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Tìm
        </Button>
      </form>
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sinh viên</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Tình trạng học vụ (từ phòng đào tạo)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {q
                        ? 'Không tìm thấy sinh viên phù hợp.'
                        : 'Chưa có sinh viên — hãy nhập danh sách sinh viên.'}
                    </TableCell>
                  </TableRow>
                )}
                {items.map((s) => (
                  <TableRow key={s.studentId} className="even:bg-muted">
                    <TableCell>
                      <Link
                        href={`/admin/students/${s.studentId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {s.fullName}
                      </Link>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {s.studentId}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{s.classId}</TableCell>
                    <TableCell>{OFFICIAL_STATUS_LABELS[s.officialAcademicStatus]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} sinh viên · trang {page}/{lastPage}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page - 1)}>Trang trước</Link>
                </Button>
              )}
              {page < lastPage && (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(page + 1)}>Trang sau</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
