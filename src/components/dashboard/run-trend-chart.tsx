'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Severity } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';

export interface RunTrendPoint {
  /** Nhãn trục: ngày mốc dữ liệu dd/MM. */
  label: string;
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}

const config = {
  CRITICAL: { label: SEVERITY_LABELS[Severity.CRITICAL], color: 'var(--chart-severity-critical)' },
  HIGH: { label: SEVERITY_LABELS[Severity.HIGH], color: 'var(--chart-severity-high)' },
  MEDIUM: { label: SEVERITY_LABELS[Severity.MEDIUM], color: 'var(--chart-severity-medium)' },
  LOW: { label: SEVERITY_LABELS[Severity.LOW], color: 'var(--chart-severity-low)' },
} satisfies ChartConfig;

/**
 * Diễn biến qua các lần đánh giá: cột chồng số sinh viên có dấu hiệu theo mức cao nhất, trục =
 * mốc dữ liệu (người dùng chốt 2026-10-19 — không theo tuần lịch).
 */
export function RunTrendChart({ data }: { data: RunTrendPoint[] }) {
  const order = [Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL] as const;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {[...order].reverse().map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-sm"
              style={{ background: config[s].color }}
            />
            {config[s].label}
          </li>
        ))}
      </ul>
      <ChartContainer config={config} className="h-60 w-full">
        <BarChart data={data} accessibilityLayer margin={{ left: -20, right: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {order.map((s, i) => (
            <Bar
              key={s}
              dataKey={s}
              stackId="students"
              fill={`var(--color-${s})`}
              maxBarSize={36}
              radius={i === order.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
}
