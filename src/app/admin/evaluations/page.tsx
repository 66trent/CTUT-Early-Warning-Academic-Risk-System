import type { Metadata } from 'next';
import { DataPagination } from '@/components/data-table/data-pagination';
import { RunForm } from '@/components/evaluations/run-form';
import { RunsTable } from '@/components/evaluations/runs-table';
import { AutoRefresh } from '@/components/imports/batch-actions';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EvaluationRunStatus, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { HELP_LINKS } from '@/lib/help-links';
import { parseListParams, type RawSearchParams } from '@/lib/list-params';
import {
  getEvaluationFormOptions,
  listEvaluationRuns,
  RUN_DEFAULT_SORT,
  RUN_SORT_KEYS,
} from '@/modules/rule-engine/services/evaluation-query.service';

export const metadata: Metadata = { title: 'Chạy đánh giá' };

interface EvaluationsPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function EvaluationsPage({ searchParams }: EvaluationsPageProps) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const list = parseListParams(params, RUN_SORT_KEYS, RUN_DEFAULT_SORT);
  const [options, runs] = await Promise.all([getEvaluationFormOptions(), listEvaluationRuns(list)]);
  const busy = runs.items.some(
    (r) => r.status === EvaluationRunStatus.QUEUED || r.status === EvaluationRunStatus.RUNNING,
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AutoRefresh active={busy} />
      <PageHeader
        helpHref={HELP_LINKS.evaluations}
        title="Chạy đánh giá"
        description="Áp dụng 12 luật cảnh báo và tính điểm rủi ro trên dữ liệu đã nạp. Hệ thống tự chạy sau mỗi lần nạp dữ liệu học tập và mỗi đêm (chế độ demo: chỉ chạy khi Admin bấm)."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Chạy đánh giá ngay</CardTitle>
          <CardDescription>
            Chỉ dùng dữ liệu phát sinh đến mốc dữ liệu và phiên bản luật đang áp dụng. Kết quả là
            dấu hiệu tham khảo, không phải quyết định học vụ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RunForm options={options} busy={busy} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Lịch sử chạy đánh giá</CardTitle>
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
