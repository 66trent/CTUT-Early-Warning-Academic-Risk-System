'use server';

import { headers } from 'next/headers';
import { getEnv } from '@/lib/env';
import { type ActionResult, toActionError } from '@/lib/errors';
import { clientIpFrom, hitRateLimit } from '@/lib/rate-limit';
import {
  registerAdvisor,
  type RegisteredAdvisorDto,
} from '../services/advisor-registration.service';
import { advisorRegistrationSchema } from '../validators/advisor-registration';

const MAX_REGISTRATIONS_PER_HOUR = 5;

/** Đăng ký Cố vấn học tập — công khai, có rate-limit theo IP. Không nhận vai trò từ client. */
export async function registerAdvisorAction(
  raw: unknown,
): Promise<ActionResult<RegisteredAdvisorDto>> {
  const ip = clientIpFrom(await headers());
  const limit = await hitRateLimit(`register-advisor:${ip}`, MAX_REGISTRATIONS_PER_HOUR, 3600);
  if (!limit.allowed) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      message: `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(limit.retryAfterSeconds / 60)} phút.`,
    };
  }

  const parsed = advisorRegistrationSchema(getEnv().STAFF_EMAIL_DOMAIN).safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ.',
    };
  }

  try {
    return { ok: true, data: await registerAdvisor(parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}
