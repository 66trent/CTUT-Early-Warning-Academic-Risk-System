import type { Metadata } from 'next';
import { Filter } from 'lucide-react';
import Link from 'next/link';
import { AuditLogsTable } from '@/components/admin/audit-logs-table';
import { DataPagination } from '@/components/data-table/data-pagination';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserRole } from '@/db/enums';
import { AUDIT_ACTIONS } from '@/lib/audit';
import { AUDIT_ACTION_LABELS } from '@/lib/audit-labels';
import { requireUser } from '@/lib/auth-server';
import { parseListParams, type RawSearchParams } from '@/lib/list-params';
import {
  AUDIT_DEFAULT_SORT,
  AUDIT_SORT_KEYS,
  auditFilterSchema,
  listAuditLogs,
} from '@/modules/admin/services/audit-log.service';

export const metadata: Metadata = { title: 'Nhật ký hệ thống' };

const ALL = 'ALL';

/** Nhật ký kiểm toán — chỉ đọc, không có thao tác sửa/xóa (docs/rules/06). */
export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireUser([UserRole.ADMIN]);
  const raw = await searchParams;
  const filter = auditFilterSchema.parse(raw);
  const list = parseListParams(raw, AUDIT_SORT_KEYS, AUDIT_DEFAULT_SORT);
  const result = await listAuditLogs(filter, list);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Nhật ký hệ thống"
        description="Ghi lại thao tác quan trọng: đăng nhập thất bại, duyệt tài khoản, nhập dữ liệu, cấu hình luật, xử lý cảnh báo, xem hồ sơ sinh viên. Không sửa hay xóa được."
      />
      <Card className="shadow-sm">
        <CardContent>
          <form action="/admin/audit-logs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="grid gap-2">
              <Label htmlFor="audit-from">Từ ngày</Label>
              <Input id="audit-from" name="from" type="date" defaultValue={filter.from} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-to">Đến ngày</Label>
              <Input id="audit-to" name="to" type="date" defaultValue={filter.to} />
            </div>
            <div className="grid gap-2 lg:col-span-2">
              <Label htmlFor="audit-action">Hành động</Label>
              <Select name="action" defaultValue={filter.action ?? ALL}>
                <SelectTrigger id="audit-action" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả hành động</SelectItem>
                  {AUDIT_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIT_ACTION_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-actor">Người thực hiện</Label>
              <Input
                id="audit-actor"
                name="actor"
                placeholder="Mã, tên hoặc email"
                defaultValue={filter.actor}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-target">Đối tượng</Label>
              <Input
                id="audit-target"
                name="target"
                placeholder="MSSV, mã lô…"
                defaultValue={filter.target}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
              <Button type="submit">
                <Filter aria-hidden />
                Lọc
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/audit-logs">Xóa bộ lọc</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <AuditLogsTable items={result.items} sort={{ sort: list.sort, dir: list.dir }} />
          <DataPagination
            basePath="/admin/audit-logs"
            params={raw}
            total={result.total}
            page={result.page}
            size={result.size}
            unit="bản ghi"
          />
        </CardContent>
      </Card>
    </div>
  );
}
