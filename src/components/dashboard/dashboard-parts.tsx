import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Severity } from '@/db/enums';
import { SEVERITY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

/**
 * Thành phần dùng chung 2 trang tổng quan (Admin, Cố vấn học tập) — docs/rules/03, 07. Server
 * Component thuần, chỉ nhận số liệu đã tổng hợp.
 */

export const SEVERITY_FILL: Record<Severity, string> = {
  [Severity.LOW]: 'var(--chart-severity-low)',
  [Severity.MEDIUM]: 'var(--chart-severity-medium)',
  [Severity.HIGH]: 'var(--chart-severity-high)',
  [Severity.CRITICAL]: 'var(--chart-severity-critical)',
};

/** Thẻ khối có tiêu đề + mô tả + đường dẫn "Xem" ở góc. */
export function DashboardCard({
  title,
  description,
  href,
  hrefLabel = 'Xem',
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('min-w-0 gap-4 shadow-sm', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
          >
            {hrefLabel}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  );
}

/**
 * Thẻ số lớn. `delta` so với lần đánh giá trước: tăng là xấu (đỏ) khi `upIsBad`.
 * `tone="hero"` nền navy cho số quan trọng nhất của trang, mỗi trang tối đa 1 thẻ.
 */
export function StatCard({
  label,
  value,
  suffix,
  hint,
  delta,
  upIsBad = true,
  href,
  tone = 'default',
  children,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  hint?: ReactNode;
  delta?: number | null;
  upIsBad?: boolean;
  href?: string;
  tone?: 'default' | 'warning' | 'high' | 'danger' | 'hero';
  children?: ReactNode;
}) {
  const hero = tone === 'hero';
  const body = (
    <>
      <p className={cn('text-sm', hero ? 'text-sidebar-foreground' : 'text-muted-foreground')}>
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-bold tabular-nums',
          hero || tone === 'danger' || tone === 'high' ? 'text-4xl' : 'text-3xl font-semibold',
          hero && 'text-sidebar-accent-foreground',
          tone === 'danger' && 'text-red-700 dark:text-red-400',
          tone === 'high' && 'text-orange-700 dark:text-orange-400',
          tone === 'warning' && 'text-amber-700 dark:text-amber-400',
          tone === 'default' && 'text-accent-strong',
        )}
      >
        {value}
        {suffix && (
          <span
            className={cn(
              'ml-1 text-base font-normal',
              hero ? 'text-sidebar-muted' : 'text-muted-foreground',
            )}
          >
            {suffix}
          </span>
        )}
      </p>
      {delta !== undefined && delta !== null && <Delta value={delta} upIsBad={upIsBad} />}
      {hint && (
        <p className={cn('mt-1 text-xs', hero ? 'text-sidebar-muted' : 'text-muted-foreground')}>
          {hint}
        </p>
      )}
      {children}
    </>
  );
  const cls = cn(
    'block rounded-xl border p-4 shadow-sm',
    hero ? 'border-sidebar bg-sidebar' : 'bg-card',
  );
  return href ? (
    <Link
      href={href}
      className={cn(
        cls,
        'transition-colors',
        hero ? 'hover:bg-sidebar-accent' : 'hover:bg-secondary',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Delta({ value, upIsBad }: { value: number; upIsBad: boolean }) {
  if (value === 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">Không đổi so với lần đánh giá trước</p>
    );
  }
  const bad = value > 0 === upIsBad;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        'mt-1 inline-flex items-center gap-0.5 text-xs font-medium',
        bad ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400',
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {value > 0 ? '+' : ''}
      {value} so với lần đánh giá trước
    </p>
  );
}

/** Thanh tỷ lệ 0–1. `tone`: `good` khi càng cao càng tốt, `attention` khi càng cao càng cần chú ý. */
export function MeterBar({
  value,
  label,
  tone = 'good',
}: {
  value: number;
  label: string;
  tone?: 'good' | 'attention';
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          'h-full rounded-full',
          tone === 'good' ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-orange-500',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Thanh ngang theo mức — CRITICAL trước; mỗi dòng bấm được (danh sách lọc sẵn). */
export function SeverityBars({
  data,
  hrefFor,
}: {
  data: { severity: Severity; count: number }[];
  hrefFor?: (severity: Severity) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="flex flex-col gap-2">
      {data.map((d) => {
        const row = (
          <>
            <span className="w-20 shrink-0 text-sm">{SEVERITY_LABELS[d.severity]}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(d.count / max) * 100}%`,
                  background: SEVERITY_FILL[d.severity],
                }}
              />
            </span>
            <span className="w-8 text-right text-sm font-medium tabular-nums">{d.count}</span>
          </>
        );
        return (
          <li key={d.severity}>
            {hrefFor && d.count > 0 ? (
              <Link
                href={hrefFor(d.severity)}
                className="flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-secondary"
              >
                {row}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-1 py-0.5">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface ProgressSegment {
  label: string;
  count: number;
  className: string;
  href?: string;
}

/** Thanh chia đoạn tiến độ xử lý (Chờ xác nhận → Đang theo dõi → Đã xong) + chú thích kèm số. */
export function SegmentedProgress({ segments }: { segments: ProgressSegment[] }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {total > 0 &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <span
                key={s.label}
                className={s.className}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {segments.map((s) => {
          const content = (
            <>
              <span aria-hidden className={cn('size-2.5 rounded-sm', s.className)} />
              {s.label}
              <span className="font-medium tabular-nums">{s.count}</span>
            </>
          );
          return (
            <li key={s.label}>
              {s.href ? (
                <Link href={s.href} className="inline-flex items-center gap-1.5 hover:underline">
                  {content}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5">{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface AttentionItem {
  key: string;
  icon: LucideIcon;
  text: string;
  count: number;
  href: string;
  tone: 'danger' | 'warning' | 'info';
}

/**
 * Dải "Cần chú ý" — chỉ hiện mục có số > 0; không có mục nào thì báo yên tâm. Mục nghiêm trọng đầu
 * tiên thành băng rôn đỏ kèm nút đi thẳng tới việc đó, các mục còn lại xếp dưới.
 */
export function AttentionStrip({
  items,
  leadAction = 'Xem ngay',
}: {
  items: AttentionItem[];
  leadAction?: string;
}) {
  const shown = items.filter((i) => i.count > 0);
  const lead = shown.find((i) => i.tone === 'danger');
  const rest = shown.filter((i) => i !== lead);
  if (shown.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <CircleCheck aria-hidden className="size-4 text-emerald-600" />
        Không có việc gì cần chú ý ngay.
      </p>
    );
  }
  return (
    <section aria-label="Cần chú ý" className="flex flex-col gap-3">
      {lead && (
        <Link
          href={lead.href}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-700 px-5 py-4 text-white transition-colors hover:bg-red-800"
        >
          <span className="flex items-center gap-3 text-base font-semibold">
            <lead.icon aria-hidden className="size-5 shrink-0" />
            <span>
              <span className="tabular-nums">{lead.count}</span> {lead.text}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-red-700">
            {leadAction}
            <ArrowRight aria-hidden className="size-4" />
          </span>
        </Link>
      )}
      {rest.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            {lead ? 'Cũng cần chú ý' : 'Cần chú ý'}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map(({ key, icon: Icon, text, count, href, tone }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="flex items-start gap-2 rounded-md bg-background/70 px-3 py-2 text-sm hover:bg-background"
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      tone === 'danger' && 'text-red-600 dark:text-red-400',
                      tone === 'warning' && 'text-amber-600 dark:text-amber-400',
                      tone === 'info' && 'text-primary',
                    )}
                  />
                  <span>
                    <span className="font-semibold tabular-nums">{count}</span> {text}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Danh sách thanh ngang 1 màu (nguồn dấu hiệu, học phần nhiều cảnh báo…). */
export function SimpleBars({
  rows,
  unit,
}: {
  rows: { key: string; label: ReactNode; count: number; icon?: LucideIcon }[];
  unit: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map(({ key, label, count, icon: Icon }) => (
        <li key={key} className="flex flex-col gap-1">
          <span className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {Icon && <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
              <span className="truncate">{label}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {count} <span className="font-normal text-muted-foreground">{unit}</span>
            </span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
