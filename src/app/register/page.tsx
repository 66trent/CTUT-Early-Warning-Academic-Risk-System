import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { RegisterForm } from '@/components/auth/register-form';
import { getAuthState } from '@/lib/auth-server';
import { getEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Đăng ký Cố vấn học tập' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  if ((await getAuthState()).kind !== 'anonymous') redirect('/');
  return (
    <AuthLayout>
      <RegisterForm staffEmailDomain={getEnv().STAFF_EMAIL_DOMAIN} />
    </AuthLayout>
  );
}
