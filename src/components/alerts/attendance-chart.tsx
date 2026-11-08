'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatVnDate } from '@/lib/dates';
import type { AttendanceSeriesDto } from '@/modules/alerts/services/student-insights.service';

/** Màu học phần theo thứ tự cố định (không theo hạng); tránh đỏ — đỏ dành cho vạch ngưỡng. */
const COLORS = ['#2563eb', '#0d9488', '#ca8a04', '#7c3aed', '#db2777'];

const day = (iso: string) => formatVnDate(iso).slice(0, 5);

/**
 * Tỷ lệ vắng (%) theo ngày chốt của từng học phần + vạch ngưỡng của luật ATT-01 đang áp dụng
 * (không ghi cứng — docs/rules/02).
 */
export function AttendanceChart({
  series,
  threshold,
}: {
  series: AttendanceSeriesDto[];
  threshold: number | null;
}) {
  const config = Object.fromEntries(
    series.map((s, i) => [s.courseId, { label: s.courseName, color: COLORS[i % COLORS.length] }]),
  ) satisfies ChartConfig;
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const data = dates.map((date) => ({
    label: day(date),
    ...Object.fromEntries(
      series.map((s) => [s.courseId, s.points.find((p) => p.date === date)?.rate ?? null]),
    ),
  }));
  const max = Math.max(threshold ?? 0, ...series.flatMap((s) => s.points.map((p) => p.rate)));
  const step = max > 40 ? 10 : 5;
  const top = Math.ceil((max + 1) / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map((s, i) => (
          <li key={s.courseId} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-0.5 w-4 rounded"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            {s.courseName}
          </li>
        ))}
        {threshold !== null && (
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-4 border-t-2 border-dashed border-red-500" />
            Ngưỡng cấm thi (&gt; {threshold}%)
          </li>
        )}
      </ul>
      <ChartContainer config={config} className="h-56 w-full">
        <LineChart data={data} accessibilityLayer margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} unit="%" domain={[0, top]} ticks={ticks} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {threshold !== null && (
            <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="5 4" />
          )}
          {series.map((s, i) => (
            <Line
              key={s.courseId}
              dataKey={s.courseId}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              type="monotone"
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
