import type { Metadata } from 'next';
import { Clock } from 'lucide-react';
import Link from 'next/link';
import { DataPagination } from '@/components/data-table/data-pagination';
import { BatchesFilter } from '@/components/imports/batches-filter';
import { BatchesTable } from '@/components/imports/batches-table';
import { CourseFreshnessTable } from '@/components/imports/course-freshness-table';
import { TemplateMenu } from '@/components/imports/template-menu';
import { UploadForm } from '@/components/imports/upload-form';
import { PageHeader } from '@/components/page-header';
import { PageTabs } from '@/components/page-tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDateTime } from '@/lib/dates';
import { HELP_LINKS } from '@/lib/help-links';
import { parseListParams, type RawSearchParams } from '@/lib/list-params';
import { getDataFreshness, STALE_DAYS } from '@/modules/admin/services/overview.service';
import {
  BATCH_DEFAULT_SORT,
  BATCH_SORT_KEYS,
  getBatchFilterOptions,
  getImportBatchDetail,
  getImportFormOptions,
  listImportBatches,
  listPendingBatches,
} from '@/modules/data-import/services/import-query.service';

export const metadata: Metadata = { title: 'Nhập dữ liệu' };

interface ImportsPageProps {
  searchParams: Promise<RawSearchParams>;
}

type ImportTab = 'new' | 'needs' | 'history';

/** Tab theo URL; link cũ mang bộ lọc lịch sử (`?type=`, `?page=`…) vẫn mở đúng tab Lịch sử. */
function tabOf(params: RawSearchParams): ImportTab {
  if (params.tab === 'needs' || params.tab === 'history' || params.tab === 'new') return params.tab;
  return ['type', 'course', 'department', 'page', 'sort'].some((k) => params[k])
    ? 'history'
    : 'new';
}

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  await requireUser([UserRole.ADMIN]);
  const params = await searchParams;
  const tab = tabOf(params);
  const list = parseListParams(params, BATCH_SORT_KEYS, BATCH_DEFAULT_SORT);
  const parent = typeof params.parent === 'string' ? params.parent : null;
  const parentDetail = parent ? await getImportBatchDetail(parent).catch(() => null) : null;
  const text = (key: string) => (typeof params[key] === 'string' ? params[key] : undefined);
  const filter = {
    dataType: text('type'),
    courseId: text('course'),
    departmentId: text('department'),
  };
  const [options, history, filterOptions, pending] = await Promise.all([
    getImportFormOptions(),
    listImportBatches(filter, list),
    getBatchFilterOptions(),
    listPendingBatches(),
  ]);
  const currentTerm = options.terms.find((t) => t.isCurrent) ?? null;
  const freshness = currentTerm
    ? await getDataFreshness({ termId: currentTerm.termId, departmentId: filter.departmentId })
    : null;
  const needsCount = freshness?.courses.filter((c) => c.needsAttention).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        helpHref={HELP_LINKS.imports}
        title="Nhập dữ liệu"
        description="Nhập danh sách sinh viên và dữ liệu học tập từ file CSV hoặc Excel."
      />

      {pending.total > 0 && (
        <section
          aria-label="Đợt nhập chờ xác nhận"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <Clock aria-hidden className="size-4" />
            <span className="tabular-nums">{pending.total}</span> đợt nhập chờ bạn xác nhận
          </p>
          <ul className="flex flex-col gap-1">
            {pending.items.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/admin/imports/${b.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-3 rounded-md bg-background/70 px-3 py-2 text-sm hover:bg-background"
                >
                  <span className="font-medium">
                    {b.dataTypeLabel}
                    {b.courseLabel ? ` · ${b.courseLabel}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {b.successRows} dòng hợp lệ · {b.errorRows} dòng lỗi ·{' '}
                    {formatVnDateTime(b.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PageTabs
        active={tab}
        tabs={[
          { key: 'new', label: 'Nhập mới', href: '/admin/imports?tab=new' },
          {
            key: 'needs',
            label: 'Cần nhập',
            href: '/admin/imports?tab=needs',
            count: needsCount,
          },
          { key: 'history', label: 'Lịch sử', href: '/admin/imports?tab=history' },
        ]}
      />

      {tab === 'new' && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>
              {parentDetail ? `Nhập lại file đã sửa · ${parentDetail.fileName}` : 'Nhập file mới'}
            </CardTitle>
            <CardDescription>
              Bạn xem trước kết quả rồi mới xác nhận nhập. Dòng lỗi được tách riêng để tải về sửa.
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
            <div className="flex flex-col gap-2 border-t pt-4">
              <TemplateMenu types={options.types} />
              <p className="text-xs text-muted-foreground">
                Nếu sửa file CSV bằng Excel, khi lưu chọn “CSV UTF-8 (Comma delimited)” và ghi ngày
                dạng 2026-10-05 để không mất dấu tiếng Việt.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'needs' &&
        (currentTerm && freshness ? (
          <Card id="do-moi-du-lieu" className="scroll-mt-20 shadow-sm">
            <CardHeader>
              <CardTitle>Học phần nào cần nhập dữ liệu · {currentTerm.termName}</CardTitle>
              <CardDescription>
                “Chậm” = cũ hơn {STALE_DAYS} ngày so với ngày dữ liệu mới nhất của cả học kỳ. Học
                phần không dùng LMS sẽ luôn “chưa có” bài trắc nghiệm / thực hành, không cần nhập.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CourseFreshnessTable courses={freshness.courses} />
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground">Chưa đặt học kỳ hiện tại.</p>
        ))}

      {tab === 'history' && (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-4">
            <BatchesFilter
              types={options.types.map((t) => ({ dataType: t.dataType, label: t.label }))}
              courses={filterOptions.courses}
              departments={filterOptions.departments}
            />
            <BatchesTable batches={history.items} sort={{ sort: list.sort, dir: list.dir }} />
            <DataPagination
              basePath="/admin/imports"
              params={params}
              total={history.total}
              page={history.page}
              size={history.size}
              unit="lần nhập"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
