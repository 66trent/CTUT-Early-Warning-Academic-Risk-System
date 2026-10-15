import { redirect } from 'next/navigation';
import { getAuthState, homePathFor } from '@/lib/auth-server';
import { UserAccountStatus } from '@/db/enums';

export const dynamic = 'force-dynamic';

/** Trang gốc: chuyển hướng theo trạng thái đăng nhập và vai trò. */
export default async function HomePage() {
  const state = await getAuthState();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'no-profile') redirect('/no-profile');
  if (state.user.accountStatus !== UserAccountStatus.ACTIVE) redirect('/pending-approval');
  redirect(homePathFor(state.user.role));
}
