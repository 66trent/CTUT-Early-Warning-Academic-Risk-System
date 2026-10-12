import type { ReactNode } from 'react';
import { RoleLayout } from '@/components/layout/role-layout';
import { UserRole } from '@/db/enums';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleLayout role={UserRole.ADMIN}>{children}</RoleLayout>;
}
