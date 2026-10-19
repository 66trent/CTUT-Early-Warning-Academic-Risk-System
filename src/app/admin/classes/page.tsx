import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ClassesFilter } from '@/components/admin/classes-filter';
import { ClassesTable, CreateClassButton } from '@/components/admin/classes-view';
import { DataPagination } from '@/components/data-table/data-pagination';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { parseListParams, type RawSearchParams, withParams } from '@/lib/list-params';
import { cn } from '@/lib/utils';
import {
  CLASS_DEFAULT_SORT,
  CLASS_SORT_KEYS,
  listAssignableAdvisors,
  listCohortYears,
  listDepartmentSummaries,
  searchClasses,
} from '@/modules/admin/services/class.service';
import { classFilterSchema } from '@/modules/admin/validators/class';

export const metadata: Metadata = { title: 'Khoa và lớp sinh hoạt' };

function DepartmentChip({
  href,
  active,
  label,
  detail,
}: {
  href: string;
  active: boolean;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex flex-col rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-secondary',
        active && 'border-primary bg-primary-soft text-primary',
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{detail}</span>
    </Link>
  );
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const filter = classFilterSchema.parse(params);
  const list = parseListParams(params, CLASS_SORT_KEYS, CLASS_DEFAULT_SORT);
  const [departments, result, advisors, cohorts] = await Promise.all([
    listDepartmentSummaries(),
    searchClasses(filter, list),
    listAssignableAdvisors(),
    listCohortYears(),
  ]);
  const totalClasses = departments.reduce((s, d) => s + d.classCount, 0);
  const totalStudents = departments.reduce((s, d) => s + d.studentCount, 0);
  const deptHref = (departmentId: string | null) =>
    `/admin/classes${withParams(params, { department: departmentId, page: null })}`;
  const filtered = !!(filter.department || filter.cohort || filter.q || filter.noAdvisor);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        helpHref={HELP_LINKS.classes}
        title="Khoa và lớp sinh hoạt"
        description="Cố vấn học tập được gán theo lớp sinh hoạt và thấy sinh viên của các lớp mình phụ trách."
        action={<CreateClassButton departments={departments} advisors={advisors} />}
      />

      <nav aria-label="Lọc theo khoa" className="flex gap-2 overflow-x-auto pb-1">
        <DepartmentChip
          href={deptHref(null)}
          active={!filter.department}
          label="Tất cả khoa"
          detail={`${totalClasses} lớp · ${totalStudents} SV`}
        />
        {departments
          .filter((d) => d.classCount > 0 || d.departmentId === filter.department)
          .map((d) => (
            <DepartmentChip
              key={d.departmentId}
              href={deptHref(d.departmentId)}
              active={filter.department === d.departmentId}
              label={d.departmentName}
              detail={`${d.classCount} lớp · ${d.studentCount} SV`}
            />
          ))}
      </nav>

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
        <CardContent className="flex flex-col gap-4">
          <Suspense>
            <ClassesFilter cohorts={cohorts} />
          </Suspense>
          <ClassesTable
            classes={result.items}
            departments={departments}
            advisors={advisors}
            sort={{ sort: list.sort, dir: list.dir }}
            filtered={filtered}
          />
          <DataPagination
            basePath="/admin/classes"
            params={params}
            total={result.total}
            page={result.page}
            size={result.size}
            unit="lớp"
          />
        </CardContent>
      </Card>

      <Collapsible>
        <Card className="shadow-sm">
          <CardHeader>
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
              <span>
                <CardTitle>Danh mục khoa</CardTitle>
                <CardDescription className="mt-1">
                  {departments.length} khoa chính thức của trường (chỉ xem).
                </CardDescription>
              </span>
              <ChevronDown
                aria-hidden
                className="size-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã khoa</TableHead>
                      <TableHead>Tên khoa</TableHead>
                      <TableHead className="text-right">Số lớp</TableHead>
                      <TableHead className="text-right">Sinh viên</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((d) => (
                      <TableRow key={d.departmentId} className="even:bg-muted">
                        <TableCell className="font-medium">{d.departmentId}</TableCell>
                        <TableCell className="whitespace-normal">{d.departmentName}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.classCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.studentCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
