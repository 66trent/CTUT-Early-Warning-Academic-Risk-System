import type { Metadata } from 'next';
import {
  BookOpenCheck,
  CalendarCheck,
  CalendarRange,
  Clock,
  FileWarning,
  GraduationCap,
  Layers,
  Laptop,
  ShieldAlert,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { DepartmentFilter } from '@/components/admin/department-filter';
import { TermFilter } from '@/components/alerts/term-filter';
import {
  type AttentionItem,
  AttentionStrip,
  DashboardCard,
  MeterBar,
  SegmentedProgress,
  SEVERITY_FILL,
  SeverityBars,
  SimpleBars,
  StatCard,
} from '@/components/dashboard/dashboard-parts';
import { RunTrendChart } from '@/components/dashboard/run-trend-chart';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Severity, SEVERITY_ORDER, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDate } from '@/lib/dates';
import { SEVERITY_LABELS } from '@/lib/labels';
import { type RawSearchParams, withParams } from '@/lib/list-params';
import { cn } from '@/lib/utils';
import { listDepartments } from '@/modules/admin/services/class.service';
import {
  type FreshnessSource,
  getAdminOverview,
  STALE_DAYS,
} from '@/modules/admin/services/overview.service';
import { SOURCE_LABELS } from '@/modules/alerts/services/alert-presentation';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { OVERDUE_DAYS } from '@/modules/alerts/services/dashboard.service';

export const metadata: Metadata = { title: 'Tổng quan' };

const SOURCE_ICONS = {
  ATTENDANCE: CalendarCheck,
  LMS: Laptop,
  ACADEMIC: GraduationCap,
  COMBINED: Layers,
} as const;

const FRESHNESS_LABELS: Record<FreshnessSource, string> = {
  ATTENDANCE: 'Điểm danh',
  LMS_QUIZ: 'Bài trắc nghiệm LMS',
  LMS_ASSIGNMENT: 'Bài thực hành LMS',
  COURSE_RESULT: 'Kết quả học phần',
};

const shortDate = (iso: string) => formatVnDate(iso).slice(0, 5);
const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === 'string' ? params[k] : undefined);
  const [terms, departments] = await Promise.all([listTermOptions(), listDepartments()]);
  const term = pickTerm(terms, str('term'));
  const department = departments.find((d) => d.departmentId === str('department')) ?? null;

  if (!term) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <PageHeader title="Tổng quan" />
        <EmptyState
          icon={CalendarRange}
          title="Chưa có học kỳ nào"
          description="Tạo học kỳ và đặt làm học kỳ hiện tại để bắt đầu nạp dữ liệu và theo dõi cảnh báo."
          action={{ href: '/admin/getting-started', label: 'Mở hướng dẫn bắt đầu' }}
        />
      </div>
    );
  }

  const o = await getAdminOverview(term.termId, department?.departmentId ?? null);
  const s = o.summary;
  const active = s.waiting + s.following;
  const totalAlerts = active + s.done;
  const latest = o.trend.at(-1) ?? null;
  const previous = o.trend.at(-2) ?? null;
  const alertsHref = (extra: Record<string, string | null>) =>
    `/admin/alerts${withParams({ term: term.termId, department: department?.departmentId }, extra)}`;

  const attention: AttentionItem[] = [
    {
      key: 'critical',
      icon: ShieldAlert,
      text: 'cảnh báo mức rất cao chưa được xác nhận',
      count: o.attention.criticalWaiting,
      href: alertsHref({ severity: Severity.CRITICAL, status: 'waiting' }),
      tone: 'danger',
    },
    {
      key: 'overdue',
      icon: Clock,
      text: `cảnh báo quá ${OVERDUE_DAYS} ngày chưa được xác nhận`,
      count: o.attention.overdue,
      href: alertsHref({ status: 'overdue' }),
      tone: 'danger',
    },
    {
      key: 'stale',
      icon: BookOpenCheck,
      text: 'học phần thiếu hoặc chậm dữ liệu điểm danh / LMS',
      count: o.attention.staleCourses,
      href: '#do-moi-du-lieu',
      tone: 'warning',
    },
    {
      key: 'errors',
      icon: FileWarning,
      text: 'lô nhập gần đây có trên 10% dòng lỗi',
      count: o.attention.highErrorBatches,
      href: '/admin/imports',
      tone: 'warning',
    },
    {
      key: 'no-advisor',
      icon: UserX,
      text: 'lớp chưa có Cố vấn học tập — cảnh báo không có người xử lý',
      count: o.attention.classesWithoutAdvisor,
      href: '/admin/classes?noAdvisor=1',
      tone: 'warning',
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Tổng quan"
        description={
          <>
            {term.termName}
            {department ? ` · ${department.departmentName}` : ''} ·{' '}
            {o.lastRun ? (
              <>
                lần đánh giá gần nhất: mốc dữ liệu {formatVnDate(o.lastRun.asOf)} ·{' '}
                <Link
                  href={`/admin/evaluations/${o.lastRun.id}`}
                  className="text-primary hover:underline"
                >
                  xem kết quả
                </Link>
              </>
            ) : (
              'chưa chạy đánh giá học kỳ này'
            )}
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <TermFilter terms={terms} value={term.termId} />
            <DepartmentFilter departments={departments} value={department?.departmentId ?? null} />
          </div>
        }
      />

      {o.setup && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary bg-primary-soft p-4 sm:flex-row sm:items-center">
          <div className="flex-1 text-sm">
            <p className="font-medium">
              Thiết lập chưa xong: {o.setup.done}/{o.setup.total} bước nền
            </p>
            {o.setup.nextTitle && (
              <p className="text-muted-foreground">Bước tiếp theo: {o.setup.nextTitle}</p>
            )}
          </div>
          <Button asChild size="sm">
            <Link href="/admin/getting-started">Mở hướng dẫn</Link>
          </Button>
        </div>
      )}

      <AttentionStrip items={attention} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Cảnh báo đang mở"
          value={active}
          hint={`${s.waiting} chờ xác nhận · ${s.following} đang theo dõi`}
          href={alertsHref({})}
        />
        <StatCard
          label="Tỷ lệ đã xử lý"
          value={`${pct(s.done, totalAlerts)}%`}
          hint={`${s.done}/${totalAlerts} cảnh báo đã xong hoặc bỏ qua`}
          href={alertsHref({ status: 'done' })}
        >
          <MeterBar value={totalAlerts === 0 ? 0 : s.done / totalAlerts} label="Tỷ lệ đã xử lý" />
        </StatCard>
        <StatCard
          label="Sinh viên có cảnh báo"
          value={s.studentsWithAlerts}
          suffix={`/ ${s.totalStudents}`}
          delta={
            latest && previous ? latest.studentsWithSignals - previous.studentsWithSignals : null
          }
          hint={`${pct(s.studentsWithAlerts, s.totalStudents)}% sinh viên`}
        />
        <StatCard
          label="Chưa đủ dữ liệu"
          value={latest?.insufficient ?? '—'}
          tone={(latest?.insufficient ?? 0) > 0 ? 'warning' : 'default'}
          hint="Không phải rủi ro thấp — cần bổ sung dữ liệu"
          href={
            o.lastRun
              ? `/admin/evaluations/${o.lastRun.id}?all=1&sort=riskScore&dir=asc`
              : undefined
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Tiến độ xử lý của Cố vấn học tập"
          description={`${totalAlerts} cảnh báo trong học kỳ`}
          href={alertsHref({})}
        >
          {totalAlerts === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có cảnh báo nào trong học kỳ này.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              <SegmentedProgress
                segments={[
                  {
                    label: 'Chờ xác nhận',
                    count: s.waiting,
                    className: 'bg-red-500',
                    href: alertsHref({ status: 'waiting' }),
                  },
                  {
                    label: 'Đang theo dõi',
                    count: s.following,
                    className: 'bg-amber-500',
                    href: alertsHref({ status: 'following' }),
                  },
                  {
                    label: 'Đã xong',
                    count: s.done,
                    className: 'bg-emerald-500',
                    href: alertsHref({ status: 'done' }),
                  },
                ]}
              />
              <div>
                <p className="mb-2 text-sm font-medium">Cảnh báo đang mở theo mức</p>
                <SeverityBars
                  data={s.activeBySeverity}
                  hrefFor={(severity) => alertsHref({ severity })}
                />
              </div>
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          title="Diễn biến qua các lần đánh giá"
          description="Số sinh viên có dấu hiệu theo mức cao nhất, mỗi cột là 1 mốc dữ liệu"
          href="/admin/evaluations"
          hrefLabel="Lịch sử chạy"
        >
          {o.trend.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có lần đánh giá cả học kỳ nào hoàn tất.
            </p>
          ) : (
            <RunTrendChart
              data={o.trend.map((p) => ({ label: shortDate(p.asOf), ...p.bySeverity }))}
            />
          )}
        </DashboardCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardCard title="Dấu hiệu theo nguồn" description="Sinh viên có cảnh báo đang mở">
          <SimpleBars
            unit="SV"
            rows={o.sources.map((x) => ({
              key: x.source,
              label: SOURCE_LABELS[x.source],
              count: x.students,
              icon: SOURCE_ICONS[x.source],
            }))}
          />
        </DashboardCard>

        <DashboardCard
          title="Học phần nhiều cảnh báo"
          description="Số sinh viên có dấu hiệu ở học phần"
        >
          {o.topCourses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có.</p>
          ) : (
            <SimpleBars
              unit="SV"
              rows={o.topCourses.map((c) => ({
                key: c.courseId,
                label: (
                  <span title={c.courseId}>
                    {c.courseName}{' '}
                    <span className="text-xs text-muted-foreground tabular-nums">{c.courseId}</span>
                  </span>
                ),
                count: c.students,
              }))}
            />
          )}
        </DashboardCard>

        <DashboardCard
          title="Cảnh báo đang mở theo lớp"
          description={
            o.classSeverity.totalClasses > o.classSeverity.rows.length
              ? `${o.classSeverity.rows.length}/${o.classSeverity.totalClasses} lớp nhiều cảnh báo nhất`
              : 'Theo mức cảnh báo'
          }
        >
          {o.classSeverity.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có.</p>
          ) : (
            <table className="w-full text-center text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-normal">Lớp</th>
                  {[...SEVERITY_ORDER].reverse().map((sv) => (
                    <th key={sv} className="pb-2 font-normal">
                      {SEVERITY_LABELS[sv]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {o.classSeverity.rows.map((r) => (
                  <tr key={r.classId}>
                    <td className="py-1 text-left font-medium tabular-nums">{r.classId}</td>
                    {[...SEVERITY_ORDER].reverse().map((sv) => (
                      <td key={sv} className="p-0.5">
                        <Link
                          href={alertsHref({ classId: r.classId, severity: sv })}
                          className={cn(
                            'block rounded-md py-1 tabular-nums hover:ring-2 hover:ring-primary',
                            r.bySeverity[sv] === 0 && 'pointer-events-none text-muted-foreground',
                          )}
                          style={
                            r.bySeverity[sv] > 0
                              ? {
                                  background: `color-mix(in srgb, ${SEVERITY_FILL[sv]} 25%, transparent)`,
                                }
                              : undefined
                          }
                          aria-label={`${r.classId}, ${SEVERITY_LABELS[sv]}: ${r.bySeverity[sv]} cảnh báo`}
                        >
                          {r.bySeverity[sv]}
                        </Link>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DashboardCard>
      </div>

      <DashboardCard
        title="Độ mới dữ liệu"
        description={`${o.freshness.totalCourses} học phần trong học kỳ. "Chậm" = ngày dữ liệu cũ hơn ${STALE_DAYS} ngày so với ngày mới nhất của học kỳ.`}
        href="/admin/imports"
        hrefLabel="Nhập dữ liệu"
        className="scroll-mt-20"
      >
        <div id="do-moi-du-lieu" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {o.freshness.sources.map((f) => {
            const problems = f.stale.length + (f.source === 'ATTENDANCE' ? f.missing.length : 0);
            return (
              <div key={f.source} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
                <p className="font-medium">{FRESHNESS_LABELS[f.source]}</p>
                <p className="text-muted-foreground">
                  {f.latest ? `Mới nhất ${formatVnDate(f.latest)}` : 'Chưa có dữ liệu'}
                </p>
                <p className="tabular-nums">
                  {f.coursesWithData}/{o.freshness.totalCourses} học phần có dữ liệu
                </p>
                {f.source === 'COURSE_RESULT' ? (
                  <span className="text-xs text-muted-foreground">Nạp khi học phần khóa điểm</span>
                ) : problems === 0 && f.missing.length === 0 && f.coursesWithData > 0 ? (
                  <span className="w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Đủ và đều
                  </span>
                ) : (
                  <ul className="flex flex-col gap-0.5 text-xs text-amber-700 dark:text-amber-400">
                    {f.stale.slice(0, 3).map((c) => (
                      <li key={c.courseId}>
                        Chậm: {c.courseName} ({shortDate(c.latest)})
                      </li>
                    ))}
                    {f.missing.slice(0, 3).map((c) => (
                      <li
                        key={c.courseId}
                        className={f.source === 'ATTENDANCE' ? '' : 'text-muted-foreground'}
                      >
                        Chưa có: {c.courseName}
                        {f.source !== 'ATTENDANCE' && ' (có thể không dùng LMS)'}
                      </li>
                    ))}
                    {f.stale.length + f.missing.length > 6 && (
                      <li>… và {f.stale.length + f.missing.length - 6} học phần khác</li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </DashboardCard>
    </div>
  );
}
