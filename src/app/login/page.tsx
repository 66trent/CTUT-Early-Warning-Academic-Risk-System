import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoginPanel } from '@/components/auth/login-panel';
import { getAuthState, homePathFor } from '@/lib/auth-server';
import { getEnv, isGoogleConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Đăng nhập' };
export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const errorCode = typeof error === 'string' ? error.toUpperCase() : null;
  if (errorCode === 'NO_STUDENT_PROFILE') redirect('/no-profile');

  const state = await getAuthState();
  if (state.kind === 'signed-in') redirect(homePathFor(state.user.role));

  const env = getEnv();
  return (
    <AuthLayout>
      <LoginPanel
        errorCode={errorCode}
        googleEnabled={isGoogleConfigured(env)}
        demoMode={env.DEMO_MODE}
        demoEmail={env.DEMO_MODE ? env.ADMIN_SEED_EMAIL : null}
      />
    </AuthLayout>
  );
}
