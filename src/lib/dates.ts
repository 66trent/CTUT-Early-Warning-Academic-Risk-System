/**
 * Ngày giờ theo múi giờ Việt Nam (UTC+7, không có giờ mùa hè).
 * DB lưu timestamptz; giao diện nhập/hiển thị theo ngày Việt Nam.
 */
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` → 00:00:00 giờ Việt Nam của ngày đó. */
export function vnStartOfDay(isoDate: string): Date {
  if (!ISO_DATE.test(isoDate)) throw new Error(`Ngày không hợp lệ: ${isoDate}`);
  return new Date(`${isoDate}T00:00:00+07:00`);
}

/** `YYYY-MM-DD` → 23:59:59.999 giờ Việt Nam của ngày đó. */
export function vnEndOfDay(isoDate: string): Date {
  if (!ISO_DATE.test(isoDate)) throw new Error(`Ngày không hợp lệ: ${isoDate}`);
  return new Date(`${isoDate}T23:59:59.999+07:00`);
}

/** Date → `YYYY-MM-DD` theo ngày Việt Nam. */
export function toVnIsoDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIME_ZONE }).format(date);
}

/** Date → `DD/MM/YYYY` để hiển thị. */
export function formatVnDate(date: Date | string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

/** Date → `HH:mm DD/MM/YYYY` để hiển thị. */
export function formatVnDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${time} ${formatVnDate(d)}`;
}
