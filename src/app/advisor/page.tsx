import type { Metadata } from 'next';
import {
  CalendarCheck,
  CalendarClock,
  Clock,
  GraduationCap,
  Inbox,
  Layers,
  Laptop,
  MessageSquareText,
  RefreshCw,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TermFilter } from '@/components/alerts/term-filter';
import {
  type AttentionItem,
  AttentionStrip,
  DashboardCard,
  MeterBar,
  SeverityBars,
  SimpleBars,
  StatCard,
} from '@/components/dashboard/dashboard-parts';
import { RunTrendChart } from '@/components/dashboard/run-trend-chart';
import { AlertStatusBadge } from '@/components/domain/alert-status-badge';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDate, formatVnDateTime } from '@/lib/dates';
import { ALERT_STATUS_LABELS } from '@/lib/labels';
import { type RawSearchParams, withParams } from '@/lib/list-params';
import { INTERVENTION_TYPE_LABELS } from '@/modules/alerts/labels';
import {
  getAdvisorClasses,
  getAttentionStudents,
  getDueFollowUps,
  getRecentActivity,
} from '@/modules/alerts/services/advisor-dashboard.service';
import { SOURCE_LABELS } from '@/modules/alerts/services/alert-presentation';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import {
  getAlertSummary,
  getLastRun,
  getRunTrend,
  getSourceBreakdown,
  OVERDUE_DAYS,
} from '@/modules/alerts/services/dashboard.service';

export const metadata: Metadata = { title: 'Tổng quan' };

const SOURCE_ICONS = {
  ATTENDANCE: CalendarCheck,
  LMS: Laptop,
  ACADEMIC: GraduationCap,
  COMBINED: Layers,
} as const;

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
const fmtRisk = (v: number | null) => (v === null ? '—' : v.toFixed(2).replace('.', ','));

/**
 * Tổng quan của Cố vấn học tập (docs/rules/07) — mọi số liệu chỉ của lớp mình phụ trách (lọc ở
 * server theo `advisorId` của lớp, docs/rules/06). Đường dẫn cũ `/advisor?alert=` (email đã gửi)
 * chuyển sang danh sách cảnh báo.
 */
export default async function AdvisorHomePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await requireUser([UserRole.ADVISOR]);
  const params = await searchParams;
  if (typeof params.alert === 'string') redirect(`/advisor/alerts${withParams(params, {})}`);
  const terms = await listTermOptions();
  const term = pickTerm(terms, typeof params.term === 'string' ? params.term : undefined);

  if (!term) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <PageHeader title="Tổng quan" />
        <EmptyState
          icon={CalendarClock}
          title="Chưa có học kỳ nào"
          description="Quản trị viên chưa tạo học kỳ. Cảnh báo sẽ xuất hiện khi có dữ liệu học tập của học kỳ."
        />
      </div>
    );
  }

  const scope = { termId: term.termId, advisorId: user.userId };
  const [classes, summary, trend, sources, students, followUps, activity, lastRun] =
    await Promise.all([
      getAdvisorClasses(user.userId, term.termId),
      getAlertSummary(scope),
      getRunTrend(scope),
      getSourceBreakdown(scope),
      getAttentionStudents(user.userId, term.termId),
      getDueFollowUps(user.userId, term.termId),
      getRecentActivity(user.userId),
      getLastRun(term.termId),
    ]);
  const alertsHref = (extra: Record<string, string | null>) =>
    `/advisor/alerts${withParams({ term: term.termId }, extra)}`;
  const total = summary.waiting + summary.following + summary.done;
  const latest = trend.at(-1) ?? null;
  const previous = trend.at(-2) ?? null;

  const header = (
    <PageHeader
      title="Tổng quan"
      description={
        <>
          {term.termName}
          {lastRun ? ` · lần đánh giá gần nhất: mốc dữ liệu ${formatVnDate(lastRun.asOf)}` : ''}
        </>
      }
      action={<TermFilter terms={terms} value={term.termId} />}
    />
  );

  if (classes.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {header}
        <EmptyState
          icon={Users}
          title="Bạn chưa được gán lớp sinh hoạt nào"
          description="Liên hệ Quản trị viên để được gán lớp. Sau khi gán, cảnh báo của sinh viên lớp bạn sẽ hiện ở đây."
        />
      </div>
    );
  }

  const attention: AttentionItem[] = [
    {
      key: 'waiting',
      icon: Inbox,
      text: 'cảnh báo mới chờ bạn xác nhận',
      count: summary.waiting,
      href: alertsHref({ status: 'waiting' }),
      tone: 'danger',
    },
    {
      key: 'overdue',
      icon: Clock,
      text: `cảnh báo đã quá ${OVERDUE_DAYS} ngày chưa xác nhận`,
      count: summary.overdue,
      href: alertsHref({ status: 'overdue' }),
      tone: 'danger',
    },
    {
      key: 'follow-up',
      icon: CalendarClock,
      text: 'sinh viên đến hẹn theo dõi lại',
      count: followUps.length,
      href: '#hen-theo-doi',
      tone: 'warning',
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {header}
      <ReferenceOnlyNotice />
      <AttentionStrip items={attention} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Cần xử lý"
          value={summary.waiting}
          tone={summary.waiting > 0 ? 'danger' : 'default'}
          hint="Mới hoặc mở lại, chờ xác nhận"
          href={alertsHref({ status: 'waiting' })}
        />
        <StatCard
          label="Đang theo dõi"
          value={summary.following}
          hint="Đã xác nhận hoặc đang can thiệp"
          href={alertsHref({ status: 'following' })}
        />
        <StatCard
          label="Đã xong"
          value={summary.done}
          hint={`${pct(summary.done, total)}% cảnh báo trong học kỳ`}
          href={alertsHref({ status: 'done' })}
        >
          <MeterBar value={total === 0 ? 0 : summary.done / total} label="Tỷ lệ đã xong" />
        </StatCard>
        <StatCard
          label="Sinh viên có cảnh báo"
          value={summary.studentsWithAlerts}
          suffix={`/ ${summary.totalStudents}`}
          delta={
            latest && previous ? latest.studentsWithSignals - previous.studentsWithSignals : null
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardCard title="Cảnh báo đang mở theo mức" href={alertsHref({})}>
          <SeverityBars
            data={summary.activeBySeverity}
            hrefFor={(severity) => alertsHref({ severity })}
          />
        </DashboardCard>
        <DashboardCard title="Dấu hiệu theo nguồn" description="Sinh viên có cảnh báo đang mở">
          <SimpleBars
            unit="SV"
            rows={sources.map((x) => ({
              key: x.source,
              label: SOURCE_LABELS[x.source],
              count: x.students,
              icon: SOURCE_ICONS[x.source],
            }))}
          />
        </DashboardCard>
        <DashboardCard title="Lớp phụ trách" description={`${classes.length} lớp sinh hoạt`}>
          <ul className="flex flex-col gap-3">
            {classes.map((c) => (
              <li key={c.classId}>
                <Link
                  href={alertsHref({ classId: c.classId })}
                  className="block rounded-md p-1 hover:bg-secondary"
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium tabular-nums">{c.classId}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {c.studentsWithAlerts}/{c.students} SV có cảnh báo
                    </span>
                  </span>
                  <MeterBar
                    value={c.students === 0 ? 0 : c.studentsWithAlerts / c.students}
                    label={`Tỷ lệ sinh viên có cảnh báo lớp ${c.classId}`}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Sinh viên cần chú ý nhất"
          description="Mức cảnh báo cao nhất, rồi điểm rủi ro (0–1)"
          href={alertsHref({})}
          hrefLabel="Tất cả"
        >
          {students.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có sinh viên nào cần chú ý trong học kỳ này.
            </p>
          ) : (
            <ul className="divide-y">
              {students.map((s) => (
                <li key={s.alertId}>
                  <Link
                    href={`/advisor/students/${s.studentId}?term=${term.termId}`}
                    className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-secondary"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.studentName}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {s.studentId} · {s.classId} · điểm rủi ro {fmtRisk(s.riskScore)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <SeverityBadge severity={s.severity} />
                      <AlertStatusBadge status={s.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
        <DashboardCard
          title="Diễn biến qua các lần đánh giá"
          description="Số sinh viên lớp bạn có dấu hiệu theo mức cao nhất"
        >
          {trend.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có lần đánh giá cả học kỳ nào hoàn tất.
            </p>
          ) : (
            <RunTrendChart
              data={trend.map((p) => ({
                label: formatVnDate(p.asOf).slice(0, 5),
                ...p.bySeverity,
              }))}
            />
          )}
        </DashboardCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Hẹn theo dõi đến hạn"
          description="Can thiệp gần nhất bạn hẹn theo dõi lại, đến hạn hôm nay hoặc đã qua"
          className="scroll-mt-20"
        >
          <div id="hen-theo-doi">
            {followUps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Không có lịch hẹn theo dõi nào đến hạn.
              </p>
            ) : (
              <ul className="divide-y">
                {followUps.map((f) => (
                  <li key={f.alertId}>
                    <Link
                      href={alertsHref({ alert: f.alertId })}
                      className="flex items-center justify-between gap-3 rounded-md px-1 py-2 hover:bg-secondary"
                    >
                      <span className="font-medium">{f.studentName}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        hẹn {formatVnDate(f.dueAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DashboardCard>
        <DashboardCard title="Hoạt động gần đây của bạn">
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Bạn chưa xử lý cảnh báo nào.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {activity.map((a, i) => {
                const Icon = a.kind === 'STATUS' ? RefreshCw : MessageSquareText;
                return (
                  <li key={`${a.alertId}-${a.at}-${i}`} className="flex gap-3 text-sm">
                    <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <Link
                        href={alertsHref({ alert: a.alertId })}
                        className="font-medium hover:underline"
                      >
                        {a.studentName}
                      </Link>{' '}
                      <span className="text-muted-foreground">
                        {a.kind === 'STATUS'
                          ? `→ ${ALERT_STATUS_LABELS[a.toStatus]}`
                          : `ghi can thiệp: ${INTERVENTION_TYPE_LABELS[a.interventionType]}`}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {formatVnDateTime(a.at)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
