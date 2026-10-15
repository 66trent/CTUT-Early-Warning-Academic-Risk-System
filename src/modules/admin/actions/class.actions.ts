'use server';

import { UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { type ActionResult } from '@/lib/errors';
import { changeClassAdvisor, createClass, updateClass } from '../services/class.service';
import { changeAdvisorSchema, createClassSchema, updateClassSchema } from '../validators/class';

const ADMIN = [UserRole.ADMIN] as const;
const REVALIDATE = ['/admin/classes'];

export async function createClassAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: createClassSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      await createClass(input, user.userId);
      return null;
    },
  });
}

export async function updateClassAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: updateClassSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      await updateClass(input, user.userId);
      return null;
    },
  });
}

export async function changeClassAdvisorAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: changeAdvisorSchema,
    revalidate: REVALIDATE,
    run: async (input, user) => {
      await changeClassAdvisor(input, user.userId);
      return null;
    },
  });
}
