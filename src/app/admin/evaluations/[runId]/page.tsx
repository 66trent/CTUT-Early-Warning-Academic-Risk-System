import type { Metadata } from 'next';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { DataCompletenessBadge } from '@/components/domain/data-completeness-badge';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { RunStatusBadge } from '@/components/evaluations/run-status-badge';
import { AutoRefresh } from '@/components/imports/batch-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EvaluationRunStatus, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDateTime } from '@/lib/dates';
import { RUN_TRIGGER_LABELS } from '@/modules/rule-engine/labels';
import { getEvaluationRunDetail } from '@/modules/rule-engine/services/evaluation-query.service';

export const metadata: Metadata = { title: 'Kết quả chạy đánh giá' };

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-accent-strong tabular-nums">{value}</p>
    </div>
  );
}

export default async function EvaluationRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  await requireUser([UserRole.ADMIN]);
  const runId = z.uuid().safeParse((await params).runId);
  if (!runId.success) notFound();
  const run = await getEvaluationRunDetail(runId.data);
  if (!run) notFound();
  const busy =
    run.status === EvaluationRunStatus.QUEUED || run.status === EvaluationRunStatus.RUNNING;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AutoRefresh active={busy} />
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/evaluations">
            <ArrowLeft aria-hidden />
            Chạy đánh giá
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1>Kết quả đánh giá · {run.termName}</h1>
          <RunStatusBadge status={run.status} />
        </div>
        <p className="mt-1 text-muted-foreground">
          {RUN_TRIGGER_LABELS[run.trigger]}
          {run.triggeredBy ? ` bởi ${run.triggeredBy}` : ''} · mốc dữ liệu{' '}
          {formatVnDateTime(run.asOf)} · tạo lúc {formatVnDateTime(run.createdAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sinh viên đã xét" value={`${run.processedStudents}/${run.totalStudents}`} />
        <Stat label="Dấu hiệu phát hiện" value={run.triggerCount} />
        <Stat label="Thiếu dữ liệu để tính điểm" value={run.insufficientCount} />
        <Stat label="Cảnh báo chất lượng dữ liệu" value={run.warnings.length} />
      </div>

      {busy && (
        <Card className="shadow-sm">
          <CardContent className="text-muted-foreground">
            Hệ thống đang chạy đánh giá ({run.processedStudents}/{run.totalStudents} sinh viên) —
            trang tự cập nhật.
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

      {run.status === EvaluationRunStatus.COMPLETED && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Dấu hiệu rủi ro theo luật ({run.triggerCount})</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
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
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mức</TableHead>
                    <TableHead>Sinh viên</TableHead>
                    <TableHead>Học phần</TableHead>
                    <TableHead>Luật</TableHead>
                    <TableHead>Lý do</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.triggers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Không phát hiện dấu hiệu rủi ro nào.
                      </TableCell>
                    </TableRow>
                  )}
                  {run.triggers.map((t, i) => (
                    <TableRow key={i} className="even:bg-muted">
                      <TableCell>
                        <SeverityBadge severity={t.severity} />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{t.studentName}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {t.studentId} · {t.classId}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {t.scopeId === t.studentId ? 'Cả học kỳ' : t.scopeId}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium tabular-nums">{t.ruleCode}</span>
                        <span className="block text-xs text-muted-foreground">{t.ruleName}</span>
                      </TableCell>
                      <TableCell className="min-w-72 whitespace-normal">{t.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {run.warnings.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Cảnh báo chất lượng dữ liệu ({run.warnings.length})</CardTitle>
            <CardDescription>
              Dữ liệu bị bỏ qua khi tính — nên kiểm tra lại với nơi xuất dữ liệu.
            </CardDescription>
          </CardHeader>
          <CardContent>
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

      {run.status === EvaluationRunStatus.COMPLETED && run.risks.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Điểm rủi ro tổng hợp</CardTitle>
            <CardDescription>
              Từ 0 (ổn định) đến 1 (rủi ro cao), có trọng số trên các nguồn đủ dữ liệu. Chỉ dùng để
              sắp xếp ưu tiên, không tạo cảnh báo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sinh viên</TableHead>
                    <TableHead>Điểm rủi ro</TableHead>
                    <TableHead>Mức dữ liệu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.risks.map((r) => (
                    <TableRow key={r.studentId} className="even:bg-muted">
                      <TableCell>
                        <span className="font-medium">{r.studentName}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {r.studentId}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {r.value === null ? 'Chưa đủ dữ liệu' : r.value.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <DataCompletenessBadge level={r.level} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
