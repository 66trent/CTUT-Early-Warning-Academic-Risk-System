import type { Metadata } from 'next';
import { GraduationCap, Search, SearchX } from 'lucide-react';
import { MajorFilter } from '@/components/admin/major-filter';
import { StudentsTable } from '@/components/admin/students-table';
import { DataPagination } from '@/components/data-table/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { HELP_LINKS } from '@/lib/help-links';
import { parseListParams, type RawSearchParams } from '@/lib/list-params';
import { listMajors } from '@/modules/admin/services/class.service';
import { searchStudents, STUDENT_SORT_KEYS } from '@/modules/admin/services/student-search.service';

export const metadata: Metadata = { title: 'Sinh viên' };

/** Admin tìm sinh viên để xem hồ sơ (chỉ đọc) và đánh dấu rút học phần. */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const q = (typeof params.q === 'string' ? params.q : '').slice(0, 100);
  const list = parseListParams(params, STUDENT_SORT_KEYS);
  const majors = await listMajors();
  const major = majors.find((m) => m.majorId === params.major) ?? null;
  const result = await searchStudents(q, list, { majorId: major?.majorId ?? null });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        helpHref={HELP_LINKS.students}
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
        {major && <input type="hidden" name="major" value={major.majorId} />}
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Tìm
        </Button>
        <MajorFilter majors={majors} value={major?.majorId ?? null} />
      </form>
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <StudentsTable
            items={result.items}
            sort={{ sort: list.sort, dir: list.dir }}
            emptyMessage={
              q || major ? (
                <EmptyState
                  icon={SearchX}
                  title="Không tìm thấy sinh viên phù hợp"
                  description="Thử gõ một phần mã số hoặc họ tên."
                />
              ) : (
                <EmptyState
                  icon={GraduationCap}
                  title="Chưa có sinh viên"
                  description="Nhập danh sách sinh viên từ file của phòng đào tạo để bắt đầu."
                  action={{ href: '/admin/imports', label: 'Nhập danh sách sinh viên' }}
                />
              )
            }
          />
          <DataPagination
            basePath="/admin/students"
            params={params}
            total={result.total}
            page={result.page}
            size={result.size}
            unit="sinh viên"
          />
        </CardContent>
      </Card>
    </div>
  );
}
