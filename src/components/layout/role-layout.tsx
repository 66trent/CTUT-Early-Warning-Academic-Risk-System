import type { ReactNode } from 'react';
import { type UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { getCurrentTermName } from '@/modules/admin/services/term.service';
import { AppShell } from './app-shell';

/** Layout dùng chung cho 3 khu vực vai trò — chặn ở server trước khi render. */
export async function RoleLayout({ role, children }: { role: UserRole; children: ReactNode }) {
  const user = await requireUser([role]);
  const currentTermName = await getCurrentTermName();
  return (
    <AppShell user={{ fullName: user.fullName, role: user.role }} currentTermName={currentTermName}>
      {children}
    </AppShell>
  );
}
