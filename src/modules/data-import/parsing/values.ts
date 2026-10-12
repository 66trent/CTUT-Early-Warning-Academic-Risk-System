/**
 * Chuẩn hóa giá trị ô theo định dạng Việt Nam (docs/rules/10, 12). Hàm thuần.
 * Thời gian trong file hiểu là giờ Việt Nam (UTC+7).
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(message: string): Parsed<T> => ({ ok: false, message });

const pad = (n: number) => String(n).padStart(2, '0');

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const AMBIGUOUS_HINT = 'Ngày có thể hiểu 2 cách — hãy ghi dạng YYYY-MM-DD (VD 2026-10-05).';

/**
 * Ngày → `YYYY-MM-DD`. Nhận `YYYY-MM-DD` hoặc `DD/MM/YYYY` (ngày, tháng đủ 2 chữ số).
 * Dạng không đủ 2 chữ số như `10/2/2026` thường do Excel tự đổi sang kiểu Mỹ → từ chối, KHÔNG đoán.
 */
export function parseDate(raw: string): Parsed<string> {
  const text = raw.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) {
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return isValidDate(y, m, d)
      ? ok(`${y}-${pad(m)}-${pad(d)}`)
      : fail(`Ngày "${raw}" không tồn tại.`);
  }
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) {
    const [dText, mText] = [match[1] ?? '', match[2] ?? ''];
    const [d, m, y] = [Number(dText), Number(mText), Number(match[3])];
    const zeroPadded = dText.length === 2 && mText.length === 2;
    if (!zeroPadded && d !== m && d <= 12 && m <= 12) return fail(AMBIGUOUS_HINT);
    if (!isValidDate(y, m, d)) {
      return m > 12 ? fail(AMBIGUOUS_HINT) : fail(`Ngày "${raw}" không tồn tại.`);
    }
    return ok(`${y}-${pad(m)}-${pad(d)}`);
  }
  return fail(`Ngày "${raw}" không đúng định dạng. Dùng YYYY-MM-DD (VD 2026-10-05).`);
}

/**
 * Ngày giờ → `YYYY-MM-DDTHH:mm:00+07:00` (giờ Việt Nam). Nhận `YYYY-MM-DD HH:mm[:ss]`,
 * `DD/MM/YYYY HH:mm` và `HH:mm DD/MM/YYYY` (dạng xuất của LMS Việt Nam).
 */
export function parseDateTime(raw: string): Parsed<string> {
  const text = raw.trim().replace(/\s+/g, ' ');
  const timeFirst = /^(\d{1,2}):(\d{2})(?::\d{2})? (.+)$/.exec(text);
  const timeLast = /^(.+?)[ T](\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  const [datePart, hour, minute] = timeFirst
    ? [timeFirst[3] ?? '', Number(timeFirst[1]), Number(timeFirst[2])]
    : timeLast
      ? [timeLast[1] ?? '', Number(timeLast[2]), Number(timeLast[3])]
      : ['', -1, -1];
  if (hour < 0 || hour > 23 || minute > 59) {
    return fail(`Thời điểm "${raw}" không đúng định dạng. Dùng YYYY-MM-DD HH:mm.`);
  }
  const date = parseDate(datePart);
  if (!date.ok) return date;
  return ok(`${date.value}T${pad(hour)}:${pad(minute)}:00+07:00`);
}

/** Số: nhận `7.5`; nhận `7,5` khi file dùng dấu `,` làm dấu thập phân (CSV phân cách `;`). */
export function parseDecimal(raw: string, decimalComma: boolean): Parsed<number> {
  let text = raw.trim();
  if (decimalComma) text = text.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return fail(`"${raw}" không phải số.`);
  return ok(Number(text));
}

export function parseInteger(raw: string): Parsed<number> {
  const text = raw.trim();
  if (!/^-?\d+$/.test(text)) return fail(`"${raw}" không phải số nguyên.`);
  return ok(Number(text));
}

/** Bỏ dấu tiếng Việt, chữ thường. */
export function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
