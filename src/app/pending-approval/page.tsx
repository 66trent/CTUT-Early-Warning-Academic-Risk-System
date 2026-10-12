import type { Metadata } from 'next';
import { Clock } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAccountStatus } from '@/db/enums';
import { getAuthState } from '@/lib/auth-server';

export const metadata: Metadata = { title: 'Trạng thái tài khoản' };
export const dynamic = 'force-dynamic';

const STATUS_TEXT: Record<
  Exclude<UserAccountStatus, UserAccountStatus.ACTIVE>,
  {
    title: string;
    description: string;
  }
> = {
  [UserAccountStatus.PENDING_APPROVAL]: {
    title: 'Tài khoản đang chờ duyệt',
    description:
      'Quản trị viên sẽ xem xét đăng ký của bạn. Sau khi được duyệt, bạn đăng nhập lại để sử dụng hệ thống.',
  },
  [UserAccountStatus.REJECTED]: {
    title: 'Đăng ký chưa được chấp nhận',
    description: 'Vui lòng liên hệ Quản trị viên để biết thêm chi tiết.',
  },
  [UserAccountStatus.SUSPENDED]: {
    title: 'Tài khoản đang tạm khóa',
    description: 'Vui lòng liên hệ Quản trị viên để được hỗ trợ.',
  },
};

/** Tài khoản chưa ACTIVE chỉ thấy trang trạng thái, không truy cập dữ liệu (docs/rules/06, 07). */
export default async function PendingApprovalPage() {
  const state = await getAuthState();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'no-profile') redirect('/no-profile');
  const status = state.user.accountStatus;
  if (status === UserAccountStatus.ACTIVE) redirect('/');
  const text = STATUS_TEXT[status];

  return (
    <AuthLayout>
      <Card className="shadow-sm">
        <CardHeader>
          <Clock aria-hidden className="size-10 text-primary" />
          <CardTitle className="text-2xl">{text.title}</CardTitle>
          <CardDescription>
            Xin chào {state.user.fullName}. {text.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
