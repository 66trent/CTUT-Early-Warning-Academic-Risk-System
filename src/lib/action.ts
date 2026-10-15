import 'server-only';
import { revalidatePath } from 'next/cache';
import { type ZodType } from 'zod';
import { type UserRole } from '@/db/enums';
import { requireActionUser } from './auth-server';
import { type SessionUser } from './authz';
import { type ActionResult, toActionError } from './errors';
import { logger } from './logger';

interface ActionOptions<TInput, TOutput> {
  roles: readonly UserRole[];
  schema: ZodType<TInput>;
  /** Đường dẫn cần làm mới sau khi thành công. */
  revalidate?: string[];
  run: (input: TInput, user: SessionUser) => Promise<TOutput>;
}

/**
 * Khung chung cho Server Action (docs/rules/01, 02):
 * kiểm tra phiên + vai trò ở server → Zod validate → service → trả DTO thuần `{ ok, data }`.
 * Lỗi nghiệp vụ trả `{ ok: false, code, message }`; lỗi lạ chỉ ghi log, không lộ chi tiết.
 */
export async function runAction<TInput, TOutput>(
  raw: unknown,
  options: ActionOptions<TInput, TOutput>,
): Promise<ActionResult<TOutput>> {
  try {
    const user = await requireActionUser(options.roles);
    const parsed = options.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ.',
      };
    }
    const data = await options.run(parsed.data, user);
    // 'layout': làm mới cả trang con và layout (header hiển thị học kỳ hiện tại).
    for (const path of options.revalidate ?? []) revalidatePath(path, 'layout');
    return { ok: true, data };
  } catch (error) {
    const result = toActionError(error);
    if (result.code === 'INTERNAL_ERROR') logger.error({ err: String(error) }, 'Server Action lỗi');
    return result;
  }
}
