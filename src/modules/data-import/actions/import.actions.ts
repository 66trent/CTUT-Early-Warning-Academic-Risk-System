'use server';

import { UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { requireActionUser } from '@/lib/auth-server';
import { type ActionResult, toActionError } from '@/lib/errors';
import { hitRateLimit } from '@/lib/rate-limit';
import { IMPORT_LIMITS } from '../parsing/errors';
import {
  confirmImportBatch,
  createImportBatch,
  discardImportBatch,
  rollbackImportBatch,
} from '../services/import-batch.service';
import { batchIdSchema, uploadImportSchema } from '../validators/import';

const ADMIN = [UserRole.ADMIN] as const;
const REVALIDATE = ['/admin/imports', '/admin/classes'];
const MAX_UPLOADS_PER_HOUR = 30;

/** Tải file lên (FormData: dataType, termId, courseId, parentBatchId, file). Chỉ Admin, có rate-limit. */
export async function uploadImportAction(
  formData: FormData,
): Promise<ActionResult<{ batchId: string }>> {
  try {
    const user = await requireActionUser(ADMIN);
    const limit = await hitRateLimit(`import-upload:${user.userId}`, MAX_UPLOADS_PER_HOUR, 3600);
    if (!limit.allowed) {
      return {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Bạn đã tải lên quá nhiều file trong 1 giờ. Vui lòng thử lại sau.',
      };
    }
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, code: 'INVALID_INPUT', message: 'Chọn file cần nạp.' };
    }
    if (file.size > IMPORT_LIMITS.maxUploadBytes) {
      return {
        ok: false,
        code: 'FILE_TOO_LARGE',
        message: 'File vượt quá 20MB. Hãy tách thành nhiều file nhỏ hơn.',
      };
    }
    const parsed = uploadImportSchema.safeParse({
      dataType: formData.get('dataType'),
      termId: formData.get('termId') ?? '',
      courseId: formData.get('courseId') ?? '',
      parentBatchId: formData.get('parentBatchId') ?? '',
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ.',
      };
    }
    const data = await createImportBatch(
      { ...parsed.data, fileName: file.name, data: Buffer.from(await file.arrayBuffer()) },
      user.userId,
    );
    return { ok: true, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function confirmImportAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: batchIdSchema,
    revalidate: REVALIDATE,
    run: async ({ batchId }, user) => {
      await confirmImportBatch(batchId, user.userId);
      return null;
    },
  });
}

export async function discardImportAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: batchIdSchema,
    revalidate: REVALIDATE,
    run: async ({ batchId }, user) => {
      await discardImportBatch(batchId, user.userId);
      return null;
    },
  });
}

export async function rollbackImportAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: batchIdSchema,
    revalidate: REVALIDATE,
    run: async ({ batchId }, user) => {
      await rollbackImportBatch(batchId, user.userId);
      return null;
    },
  });
}
