import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertsBySeverityChart, StudentsByClassChart } from '@/components/admin/overview-charts';
import { BatchStatusBadge } from '@/components/imports/batch-status-badge';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { formatVnDateTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { getAdminOverview } from '@/modules/admin/services/overview.service';

export const metadata: Metadata = { title: 'Tổng quan' };

/** Ngưỡng tỷ lệ dòng lỗi được nhấn mạnh — cùng mức cảnh báo khi xem trước lô nhập (docs/rules/12). */
const HIGH_ERROR_RATE = 0.1;

const percent = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString('vi-VN')}%`;

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="gap-1 py-4 shadow-sm">
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-accent-strong tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function AdminHomePage() {
  await requireUser([UserRole.ADMIN]);
  const o = await getAdminOverview();
  const termName = o.currentTerm?.termName ?? 'chưa đặt học kỳ hiện tại';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Tổng quan"
        description={`Số liệu học kỳ hiện tại: ${termName}. Admin chỉ giám sát, không xử lý cảnh báo.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Sinh viên" value={o.totals.students} />
        <Kpi label="Lớp sinh hoạt" value={o.totals.classes} />
        <Kpi label="Cảnh báo chưa đóng" value={o.totals.activeAlerts} hint={termName} />
        <Kpi
          label="Sinh viên chưa đủ dữ liệu"
          value={o.totals.insufficient ?? '—'}
          hint={o.lastRun ? 'Theo lần chạy đánh giá gần nhất' : 'Chưa chạy đánh giá học kỳ này'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Cảnh báo chưa đóng theo mức</CardTitle>
            <CardDescription>Mới, mở lại, đã xác nhận và đang xử lý · {termName}</CardDescription>
          </CardHeader>
          <CardContent>
            {o.totals.activeAlerts === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Không có cảnh báo chưa đóng.</p>
            ) : (
              <AlertsBySeverityChart data={o.alertsBySeverity} />
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Sĩ số theo lớp sinh hoạt</CardTitle>
            <CardDescription>{o.totals.classes} lớp</CardDescription>
          </CardHeader>
          <CardContent>
            {o.studentsByClass.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Chưa có lớp sinh hoạt.</p>
            ) : (
              <StudentsByClassChart data={o.studentsByClass} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Chất lượng nhập liệu</CardTitle>
          <CardDescription>
            {o.importQuality.length} lô nhập gần nhất. Tỷ lệ dòng lỗi trên{' '}
            {percent(HIGH_ERROR_RATE)} được tô đậm — nên kiểm tra lại với nơi xuất dữ liệu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lô nhập</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Số dòng</TableHead>
                  <TableHead className="text-right">Dòng lỗi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.importQuality.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Chưa có lô nhập nào.
                    </TableCell>
                  </TableRow>
                )}
                {o.importQuality.map((b) => (
                  <TableRow key={b.id} className="even:bg-muted">
                    <TableCell>
                      <Link
                        href={`/admin/imports/${b.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {b.fileName}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {b.dataTypeLabel} · {formatVnDateTime(b.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <BatchStatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.totalRows}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        b.errorRate !== null &&
                          b.errorRate > HIGH_ERROR_RATE &&
                          'font-semibold text-destructive',
                      )}
                    >
                      {b.errorRows}
                      {b.errorRate !== null && ` (${percent(b.errorRate)})`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Sinh viên chưa đủ dữ liệu để tính điểm rủi ro</CardTitle>
          <CardDescription>
            {o.lastRun ? (
              <>
                Theo{' '}
                <Link
                  href={`/admin/evaluations/${o.lastRun.id}`}
                  className="text-primary hover:underline"
                >
                  lần chạy đánh giá gần nhất
                </Link>{' '}
                (mốc dữ liệu {formatVnDateTime(o.lastRun.asOf)}). Không có nghĩa là rủi ro thấp —
                cần bổ sung dữ liệu.
              </>
            ) : (
              'Chưa có lần chạy đánh giá cả học kỳ nào hoàn tất.'
            )}
          </CardDescription>
        </CardHeader>
        {o.insufficientStudents.length > 0 && (
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {o.insufficientStudents.map((s) => (
                <li key={s.studentId} className="rounded-md border border-dashed px-3 py-2 text-sm">
                  <Link
                    href={`/admin/students/${s.studentId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {s.fullName}
                  </Link>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {s.studentId} · {s.classId}
                  </span>
                </li>
              ))}
            </ul>
            {(o.totals.insufficient ?? 0) > o.insufficientStudents.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                Hiển thị {o.insufficientStudents.length}/{o.totals.insufficient} sinh viên đầu tiên.
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
