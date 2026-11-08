import { z } from 'zod';
import { IMPORT_DATA_TYPES } from '@/db/enums';

export const uploadImportSchema = z.object({
  dataType: z.enum(IMPORT_DATA_TYPES, { message: 'Chọn loại dữ liệu' }),
  termId: z
    .string()
    .trim()
    .max(10)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
  /** Học phần Admin chọn (tùy chọn — trống = tự nhận diện từ file; docs/rules/12). */
  courseId: z
    .string()
    .trim()
    .max(20)
    .transform((v) => (v === '' ? null : v.toUpperCase()))
    .nullable()
    .default(null),
  parentBatchId: z
    .uuid()
    .nullable()
    .default(null)
    .or(z.literal('').transform(() => null)),
  /** Lô đang tải lên (file thứ 2 trở đi của lô nhiều file — Phase 8f). */
  batchId: z
    .uuid()
    .nullable()
    .default(null)
    .or(z.literal('').transform(() => null)),
  /** File cuối của lô → bắt đầu kiểm tra. */
  last: z
    .string()
    .default('')
    .transform((v) => v === '1'),
});

export const batchIdSchema = z.object({ batchId: z.uuid() });
