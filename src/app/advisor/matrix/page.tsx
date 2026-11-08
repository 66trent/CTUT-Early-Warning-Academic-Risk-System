import type { Metadata } from 'next';
import { Grid3x3, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TermFilter } from '@/components/alerts/term-filter';
import { SEVERITY_CLASS, SEVERITY_SHORT } from '@/components/domain/severity-badge';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { type Severity, SEVERITY_ORDER, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { SEVERITY_LABELS } from '@/lib/labels';
import { type RawSearchParams, withParams } from '@/lib/list-params';
import { cn } from '@/lib/utils';
import { getAdvisorClasses } from '@/modules/alerts/services/advisor-dashboard.service';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { getClassMatrix, TERM_COLUMN } from '@/modules/alerts/services/class-matrix.service';

export const metadata: Metadata = { title: 'Ma trận lớp' };

function Cell({
  severity,
  enrolled,
  href,
  label,
}: {
  severity: Severity | undefined;
  enrolled: boolean;
  href: string | null;
  label: string;
}) {
  if (!severity) {
    return (
      <span
        className="block text-center text-xs text-muted-foreground"
        aria-label={enrolled ? `${label}: không có dấu hiệu` : `${label}: không học`}
      >
        {enrolled ? '' : '–'}
      </span>
    );
  }
  // Ô cùng kích thước để đọc như bản đồ nhiệt, không phụ thuộc độ dài tên học phần.
  const body = (
    <span
      title={SEVERITY_LABELS[severity]}
      className={cn(
        'inline-flex h-7 w-10 items-center justify-center rounded text-xs font-semibold',
        SEVERITY_CLASS[severity],
      )}
    >
      {SEVERITY_SHORT[severity]}
    </span>
  );
  return (
    <span className="flex justify-center">
      {href ? (
        <Link
          href={href}
          aria-label={`${label}: ${SEVERITY_LABELS[severity]}, mở cảnh báo`}
          className="inline-flex rounded hover:ring-2 hover:ring-primary"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </span>
  );
}

/**
 * Ma trận sinh viên × học phần (người dùng chốt 2026-10-19): CVHT thấy ngay sinh viên nào có dấu
 * hiệu ở học phần nào; bấm ô mở cảnh báo — 1 click. Chỉ lớp mình phụ trách (docs/rules/06).
 */
export default async function MatrixPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireUser([UserRole.ADVISOR]);
  const params = await searchParams;
  const terms = await listTermOptions();
  const term = pickTerm(terms, typeof params.term === 'string' ? params.term : undefined);
  const classes = term ? await getAdvisorClasses(user.userId, term.termId) : [];

  if (!term || classes.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Ma trận lớp" />
        <EmptyState
          icon={Users}
          title="Bạn chưa được gán lớp sinh hoạt nào"
          description="Liên hệ Quản trị viên để được gán lớp."
        />
      </div>
    );
  }
  const requested = typeof params.class === 'string' ? params.class : undefined;
  const classId = classes.find((c) => c.classId === requested)?.classId ?? classes[0]?.classId;
  const matrix = classId ? await getClassMatrix(user.userId, classId, term.termId) : null;
  if (!matrix) notFound();
  // "Cả học kỳ" lên đầu: cột quan trọng nhất luôn trong màn hình, kể cả trên điện thoại.
  const columns = [
    { key: TERM_COLUMN, title: 'Cả học kỳ', sub: 'Học lực, kết hợp' },
    ...matrix.courses.map((c) => ({ key: c.courseId, title: c.courseName, sub: c.courseId })),
  ];
  const withSignals = matrix.rows.filter((r) => r.worst).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ma trận lớp"
        description="Mỗi hàng 1 sinh viên, mỗi cột 1 học phần. Ô có màu = sinh viên đang có dấu hiệu ở học phần đó; bấm ô để mở cảnh báo."
        action={<TermFilter terms={terms} value={term.termId} />}
      />
      {classes.length > 1 && (
        <nav aria-label="Chọn lớp" className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <Link
              key={c.classId}
              href={`/advisor/matrix${withParams(params, { class: c.classId })}`}
              aria-current={c.classId === classId ? 'true' : undefined}
              className={cn(
                'rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-secondary',
                c.classId === classId && 'border-primary bg-primary-soft text-primary',
              )}
            >
              {c.classId} · {c.studentsWithAlerts}/{c.students} SV
            </Link>
          ))}
        </nav>
      )}
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              Lớp <span className="font-medium text-foreground">{matrix.classId}</span> ·{' '}
              {withSignals}/{matrix.rows.length} sinh viên có dấu hiệu · {matrix.courses.length} học
              phần
            </span>
            <ul className="flex flex-wrap gap-3 text-xs" aria-label="Chú thích">
              {[...SEVERITY_ORDER].reverse().map((s) => (
                <li key={s} className="inline-flex items-center gap-1.5">
                  <span className={cn('rounded px-1.5 py-0.5 font-semibold', SEVERITY_CLASS[s])}>
                    {SEVERITY_SHORT[s]}
                  </span>
                  {SEVERITY_LABELS[s]}
                </li>
              ))}
              <li className="text-muted-foreground">Ô trống: không có dấu hiệu · –: không học</li>
            </ul>
          </div>
          {matrix.rows.length === 0 ? (
            <EmptyState icon={Grid3x3} title="Lớp chưa có sinh viên" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[34rem] table-fixed border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 z-10 w-40 bg-muted p-2 text-left font-medium sm:w-56">
                      Sinh viên
                    </th>
                    {columns.map((c) => (
                      <th key={c.key} className="p-2 text-center font-medium">
                        <span className="block leading-tight">{c.title}</span>
                        <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                          {c.sub}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((r) => (
                    <tr key={r.studentId} className="border-b last:border-0">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-card p-2 text-left font-normal"
                      >
                        <Link
                          href={`/advisor/students/${r.studentId}?term=${term.termId}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {r.fullName}
                        </Link>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {r.studentId}
                        </span>
                      </th>
                      {columns.map((c) => (
                        <td key={c.key} className="p-1">
                          <Cell
                            severity={r.cells[c.key]}
                            enrolled={c.key === TERM_COLUMN || r.enrolled.includes(c.key)}
                            href={r.alertId ? `/advisor/alerts?alert=${r.alertId}` : null}
                            label={`${r.fullName}, ${c.title}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
