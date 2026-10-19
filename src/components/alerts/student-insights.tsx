import {
  BadgeCheck,
  BookOpenCheck,
  CalendarCheck,
  GraduationCap,
  Layers,
  Laptop,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatVnDate } from '@/lib/dates';
import { ALERT_STATUS_LABELS, SEVERITY_LABELS } from '@/lib/labels';
import { INTERVENTION_TYPE_LABELS } from '@/modules/alerts/labels';
import { SOURCE_LABELS } from '@/modules/alerts/services/alert-presentation';
import type {
  StudentInsightsDto,
  TimelineEventDto,
} from '@/modules/alerts/services/student-insights.service';
import { AttendanceChart } from './attendance-chart';

const SOURCE_ICONS = {
  ATTENDANCE: CalendarCheck,
  LMS: Laptop,
  ACADEMIC: GraduationCap,
  COMBINED: Layers,
} as const;

/** Mức hiện tại theo nguồn dấu hiệu — luôn kèm chữ (docs/rules/03). */
export function SourceLevels({ sources }: { sources: StudentInsightsDto['sources'] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Dấu hiệu hiện tại theo nguồn">
      {sources.map(({ source, severity }) => {
        const Icon = SOURCE_ICONS[source];
        return (
          <li key={source} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Icon aria-hidden className="size-4" />
              {SOURCE_LABELS[source]}
            </span>
            {severity ? (
              <SeverityBadge severity={severity} />
            ) : (
              <span className="text-sm text-muted-foreground">Không có dấu hiệu</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function eventView(e: TimelineEventDto): { icon: typeof ShieldAlert; text: string } {
  switch (e.kind) {
    case 'ALERT_DETECTED':
      return { icon: ShieldAlert, text: `Phát hiện cảnh báo · mức ${SEVERITY_LABELS[e.severity]}` };
    case 'ALERT_STATUS':
      return { icon: RefreshCw, text: `Cảnh báo chuyển sang "${ALERT_STATUS_LABELS[e.toStatus]}"` };
    case 'INTERVENTION':
      return {
        icon: MessageSquareText,
        text: `Can thiệp: ${INTERVENTION_TYPE_LABELS[e.interventionType]}${e.followUp ? ' · hẹn theo dõi' : ''}`,
      };
    case 'ATTENDANCE':
      return {
        icon: CalendarCheck,
        text: `Chốt điểm danh ${e.courseName}: vắng ${e.absences}/${e.totalPeriods} tiết`,
      };
    case 'RESULT':
      return {
        icon: e.passed ? BadgeCheck : BookOpenCheck,
        text: `Công bố điểm ${e.courseName}: ${e.letterGrade}${e.passed ? '' : ' — không đạt'}`,
      };
  }
}

/** Biểu đồ vắng, ĐTB các học kỳ, dòng thời gian — phần đầu hồ sơ sinh viên (docs/rules/07). */
export function StudentInsightsPanel({ insights }: { insights: StudentInsightsDto }) {
  const threshold = insights.threshold?.percent ?? null;
  return (
    <>
      <SourceLevels sources={insights.sources} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Tỷ lệ vắng theo ngày chốt</CardTitle>
            <CardDescription>
              Tiết vắng / tổng số tiết của học phần
              {insights.threshold && !insights.threshold.countExcused
                ? ' (chỉ tính vắng không phép, theo luật đang áp dụng)'
                : ' (cả có phép và không phép)'}
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insights.attendance.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Chưa có số liệu điểm danh trong học kỳ.
              </p>
            ) : (
              <AttendanceChart series={insights.attendance} threshold={threshold} />
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 shadow-sm">
          <CardHeader>
            <CardTitle>Điểm trung bình các học kỳ</CardTitle>
            <CardDescription>Hệ 4, có trọng số tín chỉ</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.gpas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Chưa có học kỳ nào có kết quả.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {insights.gpas.map((g) => (
                  <li key={g.termId} className="flex flex-col gap-1 text-sm">
                    <span className="flex justify-between gap-2">
                      <span>{g.termName}</span>
                      <span className="font-semibold tabular-nums">
                        {g.gpa === null ? '—' : g.gpa.toFixed(2).replace('.', ',')}
                      </span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${((g.gpa ?? 0) / 4) * 100}%` }}
                      />
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {g.credits} tín chỉ
                      {g.failedCredits > 0 ? ` · không đạt ${g.failedCredits} tín chỉ` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Dòng thời gian</CardTitle>
          <CardDescription>
            Cảnh báo, can thiệp (chỉ ghi loại) và các mốc dữ liệu — mới nhất trước.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {insights.timeline.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có sự kiện nào.</p>
          ) : (
            <ol className="relative flex flex-col gap-4 border-l pl-5">
              {insights.timeline.map((e, i) => {
                const { icon: Icon, text } = eventView(e);
                return (
                  <li key={`${e.kind}-${e.at}-${i}`} className="relative text-sm">
                    <span className="absolute top-0 -left-[29px] flex size-6 items-center justify-center rounded-full border bg-background">
                      <Icon aria-hidden className="size-3.5 text-muted-foreground" />
                    </span>
                    <span className="block">{text}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatVnDate(e.at)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}
