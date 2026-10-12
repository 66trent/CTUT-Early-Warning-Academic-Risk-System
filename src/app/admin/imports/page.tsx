import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { BatchesTable } from '@/components/imports/batches-table';
import { UploadForm } from '@/components/imports/upload-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import {
  BATCHES_PAGE_SIZE,
  getImportBatchDetail,
  getImportFormOptions,
  listImportBatches,
} from '@/modules/data-import/services/import-query.service';

export const metadata: Metadata = { title: 'Nhập dữ liệu' };

interface ImportsPageProps {
  searchParams: Promise<{ page?: string; parent?: string }>;
}

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const parentDetail = params.parent
    ? await getImportBatchDetail(params.parent).catch(() => null)
    : null;
  const [options, history] = await Promise.all([
    getImportFormOptions(),
    listImportBatches({ page }),
  ]);
  const lastPage = Math.max(1, Math.ceil(history.total / BATCHES_PAGE_SIZE));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Nhập dữ liệu"
        description="Nạp danh sách sinh viên và dữ liệu học tập từ file CSV hoặc Excel."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>
            {parentDetail ? `Nạp lại file đã sửa — ${parentDetail.fileName}` : 'Nạp file mới'}
          </CardTitle>
          <CardDescription>
            Chỉ nhận dữ liệu của sinh viên đã có trong danh sách. Hệ thống tự phát hiện file đã nạp
            trước đó. Sau khi kiểm tra, bạn xem trước kết quả rồi mới xác nhận nạp; dòng lỗi được
            tách riêng để tải về sửa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <UploadForm
            options={options}
            parent={
              parentDetail
                ? {
                    batchId: parentDetail.id,
                    dataType: parentDetail.dataType,
                    termId: parentDetail.termId,
                  }
                : null
            }
          />
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">File mẫu Excel:</span>
              {options.types.map((t) => (
                <span key={t.dataType} className="inline-flex items-center gap-1">
                  <Button asChild size="sm" variant="outline">
                    <a href={t.templatePath.replace(/\.csv$/, '.xlsx')} download>
                      <Download aria-hidden />
                      {t.label}
                    </a>
                  </Button>
                  <a
                    href={t.templatePath}
                    download
                    className="text-xs text-muted-foreground underline underline-offset-2"
                  >
                    CSV
                  </a>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Nên dùng file Excel (.xlsx). Nếu sửa file CSV bằng Excel, khi lưu chọn “CSV UTF-8
              (Comma delimited)” và ghi ngày dạng 2026-10-05 — lưu kiểu khác sẽ mất dấu tiếng Việt
              hoặc đổi ngày sang kiểu Mỹ.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Lịch sử nạp dữ liệu</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BatchesTable batches={history.items} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {history.total} lần nạp · trang {page}/{lastPage}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/imports?page=${page - 1}`}>Trang trước</Link>
                </Button>
              )}
              {page < lastPage && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/imports?page=${page + 1}`}>Trang sau</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
