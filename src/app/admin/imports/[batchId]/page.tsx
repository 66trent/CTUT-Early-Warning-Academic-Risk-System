import type { Metadata } from 'next';
import { AlertTriangle, Download, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  AutoRefresh,
  RollbackAction,
  StagedActions,
  UploadingActions,
} from '@/components/imports/batch-actions';
import { BatchFilesTable } from '@/components/imports/batch-files-table';
import { BatchStatusBadge } from '@/components/imports/batch-status-badge';
import { DataPagination } from '@/components/data-table/data-pagination';
import { CourseCards } from '@/components/imports/course-cards';
import { ErrorRowsTable } from '@/components/imports/error-rows-table';
import { Button } from '@/components/ui/button';
import { PageBreadcrumbs } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ImportBatchStatus, UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDateTime } from '@/lib/dates';
import { parseListParams, type RawSearchParams } from '@/lib/list-params';
import { formatFileSize } from '@/lib/utils';
import { errorReasonLabel } from '@/modules/data-import/labels';
import {
  getImportBatchDetail,
  listErrorRows,
} from '@/modules/data-import/services/import-query.service';

export const metadata: Metadata = { title: 'Chi tiết lô nhập' };

interface BatchPageProps {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<RawSearchParams>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-accent-strong tabular-nums">{value}</p>
    </div>
  );
}

export default async function BatchPage({ params, searchParams }: BatchPageProps) {
  await requireUser([UserRole.ADMIN]);
  const batchId = z.uuid().safeParse((await params).batchId);
  if (!batchId.success) notFound();
  const batch = await getImportBatchDetail(batchId.data);
  if (!batch) notFound();
  const query = await searchParams;
  const errors =
    batch.errorRows > 0
      ? await listErrorRows(batch.id, parseListParams(query, [], { size: 50 }))
      : { items: [], total: 0, page: 1, size: 50 };
  const staged = batch.status === ImportBatchStatus.STAGED && !batch.confirmed;
  const loaded =
    batch.status === ImportBatchStatus.RECONCILED || batch.status === ImportBatchStatus.LOADED;
  const errorHeaders =
    batch.columns ?? (errors.items[0] ? Object.keys(errors.items[0].rawData) : []);
  const multi = batch.files.length > 1;
  const courseName = new Map(batch.courses.map((c) => [c.courseId, c.courseName]));
  const fileLabel = multi ? `${batch.files.length} file` : batch.fileName;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AutoRefresh active={batch.busy} />
      <div>
        <PageBreadcrumbs
          items={[{ label: 'Nhập dữ liệu', href: '/admin/imports' }, { label: fileLabel }]}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1>{batch.dataTypeLabel}</h1>
          <BatchStatusBadge status={batch.status} />
        </div>
        <p className="mt-1 text-muted-foreground">
          {fileLabel}
          {batch.termName ? ` · ${batch.termName}` : ''}
          {batch.selectedCourseId ? ` · chỉ học phần ${batch.selectedCourseId}` : ''} · tải lên{' '}
          {formatVnDateTime(batch.createdAt)} bởi {batch.performedBy}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tổng số dòng" value={batch.totalRows} />
        <Stat label="Dòng hợp lệ" value={batch.successRows} />
        <Stat label="Dòng lỗi" value={batch.errorRows} />
        {loaded ? (
          <Stat
            label="Thêm mới / cập nhật"
            value={`${batch.inserted ?? 0} / ${batch.updated ?? 0}`}
          />
        ) : (
          <Stat
            label="Tỷ lệ lỗi"
            value={`${batch.totalRows ? Math.round((batch.errorRows / batch.totalRows) * 100) : 0}%`}
          />
        )}
      </div>

      {batch.busy && (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-3 text-muted-foreground">
            {batch.status === ImportBatchStatus.UPLOADING ? (
              <>
                <p>
                  Đang tải lên — đã nhận {batch.files.length} file. Nếu đã đóng trang giữa chừng,
                  hãy hủy lần nạp này rồi nạp lại.
                </p>
                <div>
                  <UploadingActions batchId={batch.id} />
                </div>
              </>
            ) : (
              <p>
                Hệ thống đang {batch.confirmed ? 'nạp dữ liệu' : 'kiểm tra file'} — trang tự cập
                nhật.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {multi && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Các file trong lần nạp ({batch.files.length})</CardTitle>
            <CardDescription>
              Cả {batch.files.length} file được kiểm tra, xác nhận và nạp cùng lúc như 1 lô.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BatchFilesTable
              files={batch.files.map((f) => ({
                fileName: f.fileName,
                sizeLabel: f.sizeBytes > 0 ? formatFileSize(f.sizeBytes) : '',
                totalRows: f.totalRows,
                successRows: f.successRows,
                errorRows: f.errorRows,
                courses: f.courseIds.map((id) => courseName.get(id) ?? id),
              }))}
            />
          </CardContent>
        </Card>
      )}

      {batch.status === ImportBatchStatus.REJECTED && batch.errorMessage && (
        <Card className="border-destructive/30 shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">Không nạp được file</CardTitle>
            <CardDescription>{batch.errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {staged && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Xem trước và xác nhận</CardTitle>
            <CardDescription>
              Dữ liệu CHƯA được ghi. Kiểm tra vài dòng đầu bên dưới rồi xác nhận nạp. Lô chờ quá 7
              ngày sẽ tự hủy.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {batch.highErrorRate && (
              <div
                role="alert"
                className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                <p>
                  Hơn 10% số dòng bị lỗi. Nạp thiếu nhiều dòng có thể làm kết quả đánh giá thiếu
                  chính xác — nên sửa file lỗi trước khi nạp.
                </p>
              </div>
            )}
            {batch.courses.length > 0 && (
              <section className="flex flex-col gap-2" aria-label="Hệ thống đọc được">
                <h3 className="text-sm font-semibold">
                  Hệ thống đọc được {batch.courses.length} học phần trong{' '}
                  {multi ? `${batch.files.length} file` : 'file'}
                </h3>
                <CourseCards cards={batch.courses} staged />
              </section>
            )}
            {batch.preview.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {batch.previewHeaders.map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batch.preview.map((row, i) => (
                      <TableRow key={i} className="even:bg-muted">
                        {batch.previewHeaders.map((h) => (
                          <TableCell key={h}>{row[h]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <StagedActions
              batchId={batch.id}
              successRows={batch.successRows}
              errorRows={batch.errorRows}
            />
          </CardContent>
        </Card>
      )}

      {loaded && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Đã nạp dữ liệu</CardTitle>
            <CardDescription>
              Thêm mới {batch.inserted ?? 0} · cập nhật {batch.updated ?? 0} · không đổi{' '}
              {batch.unchanged ?? 0}
              {batch.completedAt ? ` · xong lúc ${formatVnDateTime(batch.completedAt)}` : ''}. Nạp
              nhầm file thì có thể hoàn tác khi lô chỉ thêm mới dữ liệu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CourseCards cards={batch.courses} staged={false} />
            <RollbackAction
              batchId={batch.id}
              allowed={batch.rollback.allowed}
              reason={batch.rollback.reason}
            />
          </CardContent>
        </Card>
      )}

      {batch.warnings.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Cảnh báo ({batch.warnings.length})</CardTitle>
            <CardDescription>
              Các dòng này vẫn được nạp, nhưng nên kiểm tra lại với nơi xuất dữ liệu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {batch.warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <AlertTriangle
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  />
                  <span>
                    <span className="font-medium tabular-nums">
                      {w.file ? `${w.file} · ` : ''}Dòng {w.row}:
                    </span>{' '}
                    {w.message}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {batch.errorRows > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Dòng lỗi ({batch.errorRows})</CardTitle>
            <CardDescription>
              Tải file lỗi về, sửa theo cột “lý do” rồi nạp lại — chỉ những dòng đã sửa được thêm.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={`/api/imports/${batch.id}/errors`}>
                  <Download aria-hidden />
                  Tải file lỗi để sửa
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/imports?parent=${batch.id}`}>
                  <RotateCw aria-hidden />
                  Nạp lại file đã sửa
                </Link>
              </Button>
            </div>
            <ErrorRowsTable
              headers={errorHeaders}
              showFile={multi}
              rows={errors.items.map((r) => ({
                sourceRowNumber: r.sourceRowNumber,
                sourceFileName: r.sourceFileName,
                reasonLabel: errorReasonLabel(r.errorReason),
                errorDetail: r.errorDetail,
                rawData: r.rawData,
              }))}
            />
            {errors.total > errors.size && (
              <DataPagination
                basePath={`/admin/imports/${batch.id}`}
                params={query}
                total={errors.total}
                page={errors.page}
                size={errors.size}
                unit="dòng lỗi"
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
