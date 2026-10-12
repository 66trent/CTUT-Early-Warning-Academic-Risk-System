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
  parentBatchId: z
    .uuid()
    .nullable()
    .default(null)
    .or(z.literal('').transform(() => null)),
});

export const batchIdSchema = z.object({ batchId: z.uuid() });
