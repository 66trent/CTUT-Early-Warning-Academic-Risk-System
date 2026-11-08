import 'server-only';
import { vnEndOfDay, vnStartOfDay } from '@/lib/dates';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';

/**
 * Mốc dữ liệu asOf cho chạy đánh giá / chạy thử. Ngày trong quá khứ CHỈ khi DEMO_MODE=true —
 * kiểm tra ở server (docs/rules/06); để trống = bây giờ.
 */
export function resolveAsOf(asOfDate: string | undefined, now = new Date()): Date {
  if (!asOfDate) return now;
  if (!getEnv().DEMO_MODE) {
    throw new AppError('FORBIDDEN', 'Chỉ chế độ trình diễn mới chọn được ngày trong quá khứ.');
  }
  if (vnStartOfDay(asOfDate) > now) {
    throw new AppError('INVALID_INPUT', 'Không chọn được ngày trong tương lai.');
  }
  // Hết ngày đã chọn, nhưng không vượt quá bây giờ (chọn hôm nay = đến thời điểm hiện tại).
  const endOfDay = vnEndOfDay(asOfDate);
  return endOfDay < now ? endOfDay : now;
}
