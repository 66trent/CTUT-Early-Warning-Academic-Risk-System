'use server';

import { z } from 'zod';
import { UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { type ActionResult } from '@/lib/errors';
import { closeTerm, createTerm, setCurrentTerm, type TermDto } from '../services/term.service';
import { createTermSchema, termIdSchema } from '../validators/term';

const ADMIN = [UserRole.ADMIN] as const;
// Header mọi trang hiển thị học kỳ hiện tại → làm mới toàn bộ layout.
const REVALIDATE = ['/'];
const termIdInput = z.object({ termId: termIdSchema });

export async function createTermAction(raw: unknown): Promise<ActionResult<TermDto>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: createTermSchema,
    revalidate: REVALIDATE,
    run: (input, user) => createTerm(input, user.userId),
  });
}

export async function setCurrentTermAction(raw: unknown): Promise<ActionResult<TermDto>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: termIdInput,
    revalidate: REVALIDATE,
    run: ({ termId }, user) => setCurrentTerm(termId, user.userId),
  });
}

export async function closeTermAction(raw: unknown): Promise<ActionResult<TermDto>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: termIdInput,
    revalidate: REVALIDATE,
    run: ({ termId }, user) => closeTerm(termId, user.userId),
  });
}
