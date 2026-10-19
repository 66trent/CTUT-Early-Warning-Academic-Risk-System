import type { Metadata } from 'next';
import { Grid3x3, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TermFilter } from '@/components/alerts/term-filter';
import { SEVERITY_FILL } from '@/components/dashboard/dashboard-parts';
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

/** Chữ viết tắt trong ô — luôn kèm chữ, không chỉ màu (docs/rules/03); chú thích ở đầu bảng. */
const SHORT: Record<Severity, string> = {
  LOW: 'T',
  MEDIUM: 'TB',
  HIGH: 'C',
  CRITICAL: 'RC',
};

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
        className="block py-1.5 text-center text-xs text-muted-foreground"
        aria-label={enrolled ? `${label}: không có dấu hiệu` : `${label}: không học`}
      >
        {enrolled ? '·' : ''}
      </span>
    );
  }
  const body = (
    <span
      className="block rounded-md py-1.5 text-center text-xs font-semibold"
      style={{ background: `color-mix(in srgb, ${SEVERITY_FILL[severity]} 30%, transparent)` }}
    >
      {SHORT[severity]}
    </span>
  );
  return href ? (
    <Link
      href={href}
      aria-label={`${label}: ${SEVERITY_LABELS[severity]} — mở cảnh báo`}
      className="block rounded-md hover:ring-2 hover:ring-primary"
    >
      {body}
    </Link>
  ) : (
    body
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
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
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
  const columns = [
    ...matrix.courses.map((c) => ({ key: c.courseId, title: c.courseName, sub: c.courseId })),
    { key: TERM_COLUMN, title: 'Cả học kỳ', sub: 'Học lực, kết hợp' },
  ];
  const withSignals = matrix.rows.filter((r) => r.worst).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
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
                  <span
                    className="rounded px-1.5 py-0.5 font-semibold"
                    style={{
                      background: `color-mix(in srgb, ${SEVERITY_FILL[s]} 30%, transparent)`,
                    }}
                  >
                    {SHORT[s]}
                  </span>
                  {SEVERITY_LABELS[s]}
                </li>
              ))}
              <li className="text-muted-foreground">· = có học, không có dấu hiệu</li>
            </ul>
          </div>
          {matrix.rows.length === 0 ? (
            <EmptyState icon={Grid3x3} title="Lớp chưa có sinh viên" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 z-10 bg-muted p-2 text-left font-medium">
                      Sinh viên
                    </th>
                    {columns.map((c) => (
                      <th key={c.key} className="min-w-24 p-2 text-center font-medium">
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
                          className="font-medium text-primary hover:underline"
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
