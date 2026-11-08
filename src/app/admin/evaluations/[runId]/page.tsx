import type { Metadata } from 'next';
import { AlertTriangle, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { StatCard } from '@/components/dashboard/dashboard-parts';
import { DataPagination } from '@/components/data-table/data-pagination';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { RunProgress } from '@/components/evaluations/run-progress';
import { RunStatusBadge } from '@/components/evaluations/run-status-badge';
import { RunStudentsFilter } from '@/components/evaluations/run-students-filter';
import { RunStudentsTable } from '@/components/evaluations/run-students-table';
import { AutoRefresh } from '@/components/imports/batch-actions';
import { PageBreadcrumbs } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EvaluationRunStatus, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDateTime } from '@/lib/dates';
import { parseListParams, type RawSearchParams } from '@/lib/list-params';
import { DATA_WARNING_LABELS, RUN_TRIGGER_LABELS } from '@/modules/rule-engine/labels';
import {
  getEvaluationRunDetail,
  listRunFilterOptions,
  listRunStudents,
  RUN_STUDENT_DEFAULT_SORT,
  RUN_STUDENT_SORT_KEYS,
} from '@/modules/rule-engine/services/evaluation-query.service';
import { runStudentFilterSchema } from '@/modules/rule-engine/validators/evaluation';

export const metadata: Metadata = { title: 'Kết quả chạy đánh giá' };

export default async function EvaluationRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  await requireUser([UserRole.ADMIN]);
  const runId = z.uuid().safeParse((await params).runId);
  if (!runId.success) notFound();
  const run = await getEvaluationRunDetail(runId.data);
  if (!run) notFound();
  const query = await searchParams;
  const filter = runStudentFilterSchema.parse(query);
  const list = parseListParams(query, RUN_STUDENT_SORT_KEYS, RUN_STUDENT_DEFAULT_SORT);
  const [result, options] =
    run.status === EvaluationRunStatus.COMPLETED
      ? await Promise.all([listRunStudents(run.id, filter, list), listRunFilterOptions(run.id)])
      : [null, { classes: [], rules: [] }];
  const busy =
    run.status === EvaluationRunStatus.QUEUED || run.status === EvaluationRunStatus.RUNNING;

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={busy} />
      <div>
        <PageBreadcrumbs
          items={[
            { label: 'Chạy đánh giá', href: '/admin/evaluations' },
            { label: `${run.termName} · ${formatVnDateTime(run.createdAt)}` },
          ]}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1>
            Kết quả đánh giá · {run.termName}
            {run.courseId ? ` · ${run.courseId}` : ''}
          </h1>
          <RunStatusBadge status={run.status} />
        </div>
        <p className="mt-1 text-muted-foreground">
          {RUN_TRIGGER_LABELS[run.trigger]}
          {run.triggeredBy ? ` bởi ${run.triggeredBy}` : ''} · tính đến {formatVnDateTime(run.asOf)}{' '}
          · tạo lúc {formatVnDateTime(run.createdAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Sinh viên có dấu hiệu"
          value={run.studentsWithSignals}
          suffix={`/ ${run.processedStudents}`}
          tone="hero"
        />
        <StatCard
          label="Cảnh báo mới"
          value={run.alertsCreated}
          tone={run.alertsCreated > 0 ? 'high' : 'default'}
          hint={`${run.alertsUpdated} cảnh báo cập nhật`}
        />
        <StatCard
          label="Sinh viên đã xét"
          value={run.processedStudents}
          suffix={`/ ${run.totalStudents}`}
        />
        <StatCard
          label="Thiếu dữ liệu để tính điểm"
          value={run.insufficientCount}
          tone={run.insufficientCount > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Cảnh báo chất lượng dữ liệu"
          value={run.warnings.length}
          tone={run.warnings.length > 0 ? 'warning' : 'default'}
        />
      </div>

      {busy && (
        <Card className="shadow-sm">
          <CardContent>
            <RunProgress
              status={run.status}
              processed={run.processedStudents}
              total={run.totalStudents}
            />
          </CardContent>
        </Card>
      )}
      {run.status === EvaluationRunStatus.FAILED && run.errorMessage && (
        <Card className="border-destructive/30 shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">Lần chạy bị lỗi</CardTitle>
            <CardDescription>{run.errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {run.status === EvaluationRunStatus.COMPLETED && result && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Kết quả theo sinh viên</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>
                {run.studentsWithSignals}/{run.processedStudents} sinh viên có dấu hiệu ·{' '}
                {run.triggerCount} dấu hiệu:
              </span>
              {run.bySeverity.map((s) => (
                <span key={s.severity} className="inline-flex items-center gap-1">
                  <SeverityBadge severity={s.severity} />
                  <span className="tabular-nums">{s.count}</span>
                </span>
              ))}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ReferenceOnlyNotice />
            <p className="text-sm text-muted-foreground">
              Điểm ưu tiên từ 0 đến 1, chỉ dùng để sắp xếp thứ tự xem, không tạo cảnh báo. Bấm
              &ldquo;N dấu hiệu&rdquo; để xem từng luật.
            </p>
            <Suspense>
              <RunStudentsFilter classes={options.classes} rules={options.rules} />
            </Suspense>
            <RunStudentsTable
              rows={result.items}
              sort={{ sort: list.sort, dir: list.dir }}
              emptyMessage={
                <EmptyState
                  icon={SearchX}
                  title={
                    filter.all
                      ? 'Không có sinh viên nào khớp bộ lọc'
                      : 'Không có sinh viên nào có dấu hiệu khớp bộ lọc'
                  }
                  description={
                    filter.all
                      ? 'Thử bỏ bớt điều kiện lọc.'
                      : 'Chọn "Tất cả sinh viên" để xem điểm ưu tiên của mọi sinh viên.'
                  }
                />
              }
            />
            <DataPagination
              basePath={`/admin/evaluations/${run.id}`}
              params={query}
              total={result.total}
              page={result.page}
              size={result.size}
              unit="sinh viên"
            />
          </CardContent>
        </Card>
      )}

      {run.warnings.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Cảnh báo chất lượng dữ liệu ({run.warnings.length})</CardTitle>
            <CardDescription>
              Dữ liệu bị bỏ qua khi tính, nên kiểm tra lại với nơi xuất dữ liệu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-wrap gap-2">
              {run.warningSummary.map((s) => (
                <li key={s.code} className="rounded-md border bg-background px-3 py-1.5 text-sm">
                  {DATA_WARNING_LABELS[s.code] ?? s.code}:{' '}
                  <span className="font-semibold tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-2 text-sm">
              {run.warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <AlertTriangle
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  />
                  <span>
                    <span className="font-medium tabular-nums">
                      {[w.studentId, w.courseId].filter(Boolean).join(' · ')}:
                    </span>{' '}
                    {w.message}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
