import type { Metadata } from 'next';
import { UserX } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthState } from '@/lib/auth-server';

export const metadata: Metadata = { title: 'Chưa có hồ sơ' };
export const dynamic = 'force-dynamic';

/** Đăng nhập được nhưng chưa có hồ sơ — KHÔNG tự tạo hồ sơ (docs/rules/07, 09). */
export default async function NoProfilePage() {
  const state = await getAuthState();
  if (state.kind === 'signed-in') redirect('/');

  return (
    <AuthLayout>
      <Card className="shadow-sm">
        <CardHeader>
          <UserX aria-hidden className="size-10 text-primary" />
          <CardTitle className="text-2xl">Chưa có hồ sơ của bạn</CardTitle>
          <CardDescription>
            Hệ thống chưa có hồ sơ sinh viên gắn với email này. Vui lòng liên hệ phòng Đào tạo để
            được cập nhật danh sách, sau đó đăng nhập lại.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.kind === 'no-profile' ? (
            <SignOutButton />
          ) : (
            <Button asChild variant="outline">
              <a href="/login">Về trang đăng nhập</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
