'use server';

import { z } from 'zod';
import { UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { AppError, type ActionResult } from '@/lib/errors';
import { hitRateLimit } from '@/lib/rate-limit';
import {
  type QuickSearchStudentDto,
  quickSearchStudents,
} from '../services/student-search.service';

const quickSearchSchema = z.object({ q: z.string().trim().max(60) });

/** 60 lần/phút/người — đủ cho gõ liên tục (có debounce), chặn dò quét dữ liệu. */
const QUICK_SEARCH_MAX = 60;

/**
 * Tìm nhanh sinh viên (Ctrl+K) cho Admin và Cố vấn học tập. CVHT chỉ nhận sinh viên lớp mình phụ
 * trách — lọc ở server theo `advisorId` của lớp (docs/rules/06), không tin dữ liệu client gửi.
 */
export async function quickSearchStudentsAction(
  raw: unknown,
): Promise<ActionResult<QuickSearchStudentDto[]>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN, UserRole.ADVISOR],
    schema: quickSearchSchema,
    run: async ({ q }, user) => {
      const limit = await hitRateLimit(`quick-search:${user.userId}`, QUICK_SEARCH_MAX, 60);
      if (!limit.allowed) {
        throw new AppError('RATE_LIMITED', 'Bạn tìm quá nhanh, thử lại sau ít giây.');
      }
      return quickSearchStudents(q, user.role === UserRole.ADVISOR ? user.userId : null);
    },
  });
}
