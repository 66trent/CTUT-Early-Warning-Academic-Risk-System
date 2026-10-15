'use server';

import { UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { type ActionResult } from '@/lib/errors';
import { changeAccountStatus, changeRole, changeStaffCode } from '../services/account.service';
import {
  changeAccountStatusSchema,
  changeRoleSchema,
  changeStaffCodeSchema,
} from '../validators/account';

const ADMIN = [UserRole.ADMIN] as const;
const REVALIDATE = ['/admin/users', '/admin/classes'];

export async function changeAccountStatusAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: changeAccountStatusSchema,
    revalidate: REVALIDATE,
    run: async ({ userId, action }, user) => {
      await changeAccountStatus(userId, action, user.userId);
      return null;
    },
  });
}

export async function changeRoleAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: changeRoleSchema,
    revalidate: REVALIDATE,
    run: async ({ userId, role }, user) => {
      await changeRole(userId, role, user.userId);
      return null;
    },
  });
}

export async function changeStaffCodeAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: ADMIN,
    schema: changeStaffCodeSchema,
    revalidate: REVALIDATE,
    run: async ({ userId, newUserId }, user) => {
      await changeStaffCode(userId, newUserId, user.userId);
      return null;
    },
  });
}
