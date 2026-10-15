import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlertStatusBadge } from '@/components/domain/alert-status-badge';
import { DataCompletenessBadge } from '@/components/domain/data-completeness-badge';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { SeverityBadge } from '@/components/domain/severity-badge';
import { AppShell } from '@/components/layout/app-shell';
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
import { AlertStatus, DataCompletenessLevel, SEVERITY_ORDER, Severity, UserRole } from '@/db/enums';
import { getEnv } from '@/lib/env';
import { SampleForm } from './sample-form';

export const metadata: Metadata = { title: 'Kiểm tra giao diện' };
export const dynamic = 'force-dynamic';

const SAMPLE_ROWS = [
  {
    id: 'KTPM2311003',
    name: 'Lê Văn Cường',
    severity: Severity.CRITICAL,
    status: AlertStatus.OPEN,
  },
  {
    id: 'KTPM2311005',
    name: 'Phạm Thị Dung',
    severity: Severity.HIGH,
    status: AlertStatus.ACKNOWLEDGED,
  },
  {
    id: 'KTPM2311002',
    name: 'Trần Thị Bích',
    severity: Severity.MEDIUM,
    status: AlertStatus.IN_PROGRESS,
  },
  { id: 'KTPM2311004', name: 'Võ Minh Đức', severity: Severity.LOW, status: AlertStatus.RESOLVED },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">{children}</CardContent>
    </Card>
  );
}

/** Trang kiểm tra token màu/thành phần ở chế độ sáng và tối. Chỉ mở khi DEMO_MODE=true. */
export default function DesignCheckPage() {
  if (!getEnv().DEMO_MODE) notFound();

  return (
    <AppShell
      user={{ fullName: 'Người dùng mẫu', role: UserRole.ADMIN }}
      currentTermName="Học kỳ 1, 2026–2027"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1>Kiểm tra giao diện</h1>
          <p className="mt-1 text-muted-foreground">
            Đổi giao diện sáng/tối bằng nút trên thanh tiêu đề để so sánh màu.
          </p>
        </div>

        <Section title="Nút" description="Mỗi vùng thao tác chỉ có 1 nút chính màu xanh dương.">
          <Button>Nút chính</Button>
          <Button variant="outline">Nút phụ</Button>
          <Button variant="ghost">Nút nhẹ</Button>
          <Button variant="link">Liên kết</Button>
          <Button variant="destructive">Xóa</Button>
          <Button disabled>Đang tắt</Button>
        </Section>

        <Section title="Mức cảnh báo" description="Luôn có nhãn chữ đi kèm màu.">
          {SEVERITY_ORDER.map((s) => (
            <SeverityBadge key={s} severity={s} />
          ))}
        </Section>

        <Section title="Trạng thái cảnh báo">
          {Object.values(AlertStatus).map((s) => (
            <AlertStatusBadge key={s} status={s} />
          ))}
        </Section>

        <Section
          title="Độ đầy đủ dữ liệu"
          description="Phân biệt bằng icon và nét viền, không dùng màu."
        >
          {Object.values(DataCompletenessLevel).map((l) => (
            <DataCompletenessBadge key={l} level={l} />
          ))}
        </Section>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Bảng</CardTitle>
            <ReferenceOnlyNotice />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã số</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Mức</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_ROWS.map((row) => (
                  <TableRow key={row.id} className="even:bg-muted">
                    <TableCell className="font-medium">{row.id}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={row.severity} />
                    </TableCell>
                    <TableCell>
                      <AlertStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline">
                        Xem
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Form</CardTitle>
            <CardDescription>Bấm “Lưu” khi để trống để xem thông báo lỗi.</CardDescription>
          </CardHeader>
          <CardContent>
            <SampleForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
