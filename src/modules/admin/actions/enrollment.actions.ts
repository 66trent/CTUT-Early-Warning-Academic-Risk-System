'use server';

import { getDataSource } from '@/db/data-source';
import { UserRole } from '@/db/enums';
import { runAction } from '@/lib/action';
import { assertScope } from '@/lib/authz';
import { type ActionResult } from '@/lib/errors';
import { setEnrollmentWithdrawn } from '../services/enrollment.service';
import { setWithdrawnSchema } from '../validators/enrollment';

/** Admin đánh dấu / bỏ đánh dấu rút học phần ở hồ sơ sinh viên (docs/rules/09). */
export async function setEnrollmentWithdrawnAction(raw: unknown): Promise<ActionResult<null>> {
  return runAction(raw, {
    roles: [UserRole.ADMIN],
    schema: setWithdrawnSchema,
    revalidate: ['/admin/students'],
    run: async (input, user) => {
      await assertScope(user, { studentId: input.studentId, resourceType: 'SourceRecord' });
      await (
        await getDataSource()
      ).transaction((em) => setEnrollmentWithdrawn(em, input, user.userId));
      return null;
    },
  });
}
