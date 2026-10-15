'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    await authClient.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <Button
      variant={compact ? 'ghost' : 'outline'}
      size={compact ? 'icon' : 'default'}
      className={compact ? 'size-11' : undefined}
      aria-label="Đăng xuất"
      disabled={pending}
      onClick={() => void signOut()}
    >
      <LogOut aria-hidden />
      {!compact && 'Đăng xuất'}
    </Button>
  );
}
