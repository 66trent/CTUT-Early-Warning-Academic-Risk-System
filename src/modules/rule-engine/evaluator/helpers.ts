import { z } from 'zod';
import { Severity, SEVERITY_ORDER } from '@/db/enums';

export const severitySchema = z.enum(Severity);

export const severityRank = (s: Severity) => SEVERITY_ORDER.indexOf(s);

export function maxSeverity(values: readonly Severity[]): Severity | null {
  return values.reduce<Severity | null>(
    (max, s) => (max === null || severityRank(s) > severityRank(max) ? s : max),
    null,
  );
}

/** Nâng `steps` bậc, tối đa CRITICAL. */
export function bumpSeverity(s: Severity, steps: number): Severity {
  const index = Math.min(SEVERITY_ORDER.length - 1, severityRank(s) + steps);
  return SEVERITY_ORDER[index] ?? Severity.CRITICAL;
}

export const DAY_MS = 24 * 3600 * 1000;

/** Phần trăm kiểu Việt Nam, 1 chữ số thập phân: 0.2333 → "23,3%". */
export function formatPercent(ratio: number): string {
  return `${(Math.round(ratio * 1000) / 10).toLocaleString('vi-VN')}%`;
}

/** Số kiểu Việt Nam: 0.33 → "0,33". */
export function formatNumber(value: number, digits = 2): string {
  return (Math.round(value * 10 ** digits) / 10 ** digits).toLocaleString('vi-VN');
}

/** Ngày giờ Việt Nam dạng `dd/mm/yyyy`. */
export function formatVnDate(date: Date): string {
  return date.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Ngày `YYYY-MM-DD` theo giờ Việt Nam (cho inputSnapshot). */
export function vnDateKey(date: Date): string {
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Điểm thang 10 → số nguyên phần mười để so sánh ổn định (5,0 → 50). */
export const tenths = (score: number) => Math.round(score * 10);
