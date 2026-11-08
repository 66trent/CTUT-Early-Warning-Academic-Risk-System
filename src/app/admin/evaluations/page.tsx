import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { TermFilter } from '@/components/alerts/term-filter';
import { StatCard } from '@/components/dashboard/dashboard-parts';
import { DataPagination } from '@/components/data-table/data-pagination';
import { SeverityCounts } from '@/components/domain/severity-counts';
import { RunForm } from '@/components/evaluations/run-form';
import { RunProgress } from '@/components/evaluations/run-progress';
import { RunsTable } from '@/components/evaluations/runs-table';
import { AutoRefresh } from '@/components/imports/batch-actions';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EvaluationRunStatus, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDateTime } from '@/lib/dates';
import { HELP_LINKS } from '@/lib/help-links';
import { parseListParams, type RawSearchParams } from '@/lib/list-params';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { RUN_TRIGGER_LABELS } from '@/modules/rule-engine/labels';
import {
  getEvaluationFormOptions,
  getLatestEvaluationRun,
  listEvaluationRuns,
  RUN_DEFAULT_SORT,
  RUN_SORT_KEYS,
} from '@/modules/rule-engine/services/evaluation-query.service';

export const metadata: Metadata = { title: 'Chạy đánh giá' };

interface EvaluationsPageProps {
  searchParams: Promise<RawSearchParams>;
}

const isBusy = (status: EvaluationRunStatus) =>
  status === EvaluationRunStatus.QUEUED || status === EvaluationRunStatus.RUNNING;

export default async function EvaluationsPage({ searchParams }: EvaluationsPageProps) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const list = parseListParams(params, RUN_SORT_KEYS, RUN_DEFAULT_SORT);
  const terms = await listTermOptions();
  const term = pickTerm(terms, typeof params.term === 'string' ? params.term : undefined);
  const [options, runs, latest] = await Promise.all([
    getEvaluationFormOptions(),
    listEvaluationRuns(list, term?.termId),
    term ? getLatestEvaluationRun(term.termId) : null,
  ]);
  const busy = runs.items.some((r) => isBusy(r.status));

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={busy} />
      <PageHeader
        helpHref={HELP_LINKS.evaluations}
        title="Chạy đánh giá"
        description="Áp dụng 12 luật cảnh báo và tính điểm ưu tiên trên dữ liệu đã nhập."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Chạy đánh giá ngay</CardTitle>
          <CardDescription>
            Chỉ dùng dữ liệu phát sinh đến ngày đã chọn và phiên bản luật đang áp dụng. Kết quả là
            dấu hiệu tham khảo, không phải quyết định học vụ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RunForm options={options} busy={busy} />
        </CardContent>
      </Card>

      {latest && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Lần chạy gần nhất · {latest.termName}</CardTitle>
              <CardDescription className="mt-1">
                {formatVnDateTime(latest.createdAt)} · {RUN_TRIGGER_LABELS[latest.trigger]}
              </CardDescription>
            </div>
            <Link
              href={`/admin/evaluations/${latest.id}`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Xem kết quả
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {isBusy(latest.status) ? (
              <RunProgress
                status={latest.status}
                processed={latest.processedStudents}
                total={latest.totalStudents}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Sinh viên có dấu hiệu"
                  value={latest.studentsWithSignals}
                  suffix={`/ ${latest.processedStudents}`}
                  tone="hero"
                />
                <StatCard label="Cảnh báo mới" value={latest.alertsCreated} />
                <StatCard label="Cảnh báo cập nhật" value={latest.alertsUpdated} />
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">
                    {latest.triggerCount} dấu hiệu theo mức
                  </p>
                  <SeverityCounts items={latest.bySeverity} className="mt-2" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Lịch sử chạy đánh giá</CardTitle>
          {term && <TermFilter terms={terms} value={term.termId} />}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RunsTable data={runs.items} sort={{ sort: list.sort, dir: list.dir }} />
          <DataPagination
            basePath="/admin/evaluations"
            params={params}
            total={runs.total}
            page={runs.page}
            size={runs.size}
            unit="lần chạy"
          />
        </CardContent>
      </Card>
    </div>
  );
}
