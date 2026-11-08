import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type RawSearchParams, withParams } from '@/lib/list-params';

/** Xuất danh sách cảnh báo theo bộ lọc đang chọn (Excel + CSV) — tải qua Route Handler GET. */
export function ExportAlertsButton({
  basePath,
  params,
}: {
  basePath: string;
  params: RawSearchParams;
}) {
  const href = (format: 'xlsx' | 'csv') =>
    `${basePath}${withParams(params, { format, page: null, size: null, sort: null, dir: null, alert: null })}`;
  return (
    <span className="inline-flex items-center gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={href('xlsx')} download>
          <Download aria-hidden />
          Xuất Excel
        </a>
      </Button>
      <a
        href={href('csv')}
        download
        className="text-xs text-muted-foreground underline underline-offset-2"
      >
        CSV
      </a>
    </span>
  );
}
