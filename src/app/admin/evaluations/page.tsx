import type { Metadata } from 'next';
import Link from 'next/link';
import { RunForm } from '@/components/evaluations/run-form';
import { RunsTable } from '@/components/evaluations/runs-table';
import { AutoRefresh } from '@/components/imports/batch-actions';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EvaluationRunStatus, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import {
  getEvaluationFormOptions,
  listEvaluationRuns,
  RUNS_PAGE_SIZE,
} from '@/modules/rule-engine/services/evaluation-query.service';

export const metadata: Metadata = { title: 'Chạy đánh giá' };

interface EvaluationsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function EvaluationsPage({ searchParams }: EvaluationsPageProps) {
  await requireUser([UserRole.ADMIN]);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [options, runs] = await Promise.all([getEvaluationFormOptions(), listEvaluationRuns(page)]);
  const busy = runs.items.some(
    (r) => r.status === EvaluationRunStatus.QUEUED || r.status === EvaluationRunStatus.RUNNING,
  );
  const lastPage = Math.max(1, Math.ceil(runs.total / RUNS_PAGE_SIZE));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AutoRefresh active={busy} />
      <PageHeader
        title="Chạy đánh giá"
        description="Áp dụng 10 luật cảnh báo và tính điểm rủi ro trên dữ liệu đã nạp. Hệ thống tự chạy sau mỗi lần nạp dữ liệu học tập."
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
          <RunsTable data={runs.items} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {runs.total} lần chạy · trang {page}/{lastPage}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/evaluations?page=${page - 1}`}>Trang trước</Link>
                </Button>
              )}
              {page < lastPage && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/evaluations?page=${page + 1}`}>Trang sau</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
