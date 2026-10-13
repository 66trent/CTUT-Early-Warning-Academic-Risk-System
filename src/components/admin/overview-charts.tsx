'use client';

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Severity } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';

/** Màu cột theo mức — biến CSS khai báo 1 lần trong globals.css (docs/rules/03). */
const SEVERITY_FILL: Record<Severity, string> = {
  [Severity.LOW]: 'var(--chart-severity-low)',
  [Severity.MEDIUM]: 'var(--chart-severity-medium)',
  [Severity.HIGH]: 'var(--chart-severity-high)',
  [Severity.CRITICAL]: 'var(--chart-severity-critical)',
};

const studentsConfig = {
  students: { label: 'Sinh viên', color: 'var(--chart-primary)' },
} satisfies ChartConfig;

const alertsConfig = {
  count: { label: 'Cảnh báo' },
} satisfies ChartConfig;

/** Sĩ số theo lớp sinh hoạt (số liệu đã tổng hợp ở server — docs/rules/05). */
export function StudentsByClassChart({ data }: { data: { classId: string; students: number }[] }) {
  return (
    <ChartContainer config={studentsConfig} className="h-64 w-full">
      <BarChart data={data} accessibilityLayer margin={{ left: -16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="classId" tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="students" fill="var(--color-students)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

/** Cảnh báo chưa đóng theo mức — đúng bảng màu Severity, CRITICAL trước. */
export function AlertsBySeverityChart({ data }: { data: { severity: Severity; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: SEVERITY_LABELS[d.severity] }));
  return (
    <ChartContainer config={alertsConfig} className="h-64 w-full">
      <BarChart data={rows} accessibilityLayer margin={{ left: -16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey="count" radius={4}>
          {rows.map((r) => (
            <Cell key={r.severity} fill={SEVERITY_FILL[r.severity]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
