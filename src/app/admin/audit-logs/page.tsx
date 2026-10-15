import type { Metadata } from 'next';
import { Filter } from 'lucide-react';
import Link from 'next/link';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserRole } from '@/db/enums';
import { AUDIT_ACTIONS } from '@/lib/audit';
import { AUDIT_ACTION_LABELS } from '@/lib/audit-labels';
import { requireUser } from '@/lib/auth-server';
import { formatVnDateTime } from '@/lib/dates';
import {
  AUDIT_PAGE_SIZE,
  auditFilterSchema,
  isAuditAction,
  listAuditLogs,
} from '@/modules/admin/services/audit-log.service';

export const metadata: Metadata = { title: 'Nhật ký hệ thống' };

const ALL = 'ALL';

/** Nhật ký kiểm toán — chỉ đọc, không có thao tác sửa/xóa (docs/rules/06). */
export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser([UserRole.ADMIN]);
  const raw = await searchParams;
  const filter = auditFilterSchema.parse(raw);
  const { items, total } = await listAuditLogs(filter);
  const lastPage = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const key of ['from', 'to', 'action', 'actor', 'target'] as const) {
      const value = filter[key];
      if (value) next.set(key, value);
    }
    next.set('page', String(p));
    return `/admin/audit-logs?${next.toString()}`;
  };

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
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Đối tượng</TableHead>
                  <TableHead>Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Không có bản ghi phù hợp.
                    </TableCell>
                  </TableRow>
                )}
                {items.map((log) => (
                  <TableRow key={log.id} className="align-top even:bg-muted">
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatVnDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {isAuditAction(log.action) ? AUDIT_ACTION_LABELS[log.action] : log.action}
                    </TableCell>
                    <TableCell>
                      {log.actorId ? (
                        <>
                          {log.actorName ?? log.actorId}
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {log.actorId}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Không xác định</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {log.targetType}
                      {log.targetId && (
                        <span className="block max-w-48 truncate text-xs text-muted-foreground">
                          {log.targetId}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-64 text-xs whitespace-normal">
                      {log.detail.length === 0
                        ? '—'
                        : log.detail.map((d) => (
                            <span key={d.key} className="block break-all">
                              <span className="text-muted-foreground">{d.key}:</span> {d.value}
                            </span>
                          ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} bản ghi · trang {filter.page}/{lastPage}
            </span>
            <div className="flex gap-2">
              {filter.page > 1 && (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(filter.page - 1)}>Trang trước</Link>
                </Button>
              )}
              {filter.page < lastPage && (
                <Button asChild size="sm" variant="outline">
                  <Link href={pageHref(filter.page + 1)}>Trang sau</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
