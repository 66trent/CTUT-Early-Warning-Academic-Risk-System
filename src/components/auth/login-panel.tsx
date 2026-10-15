'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/lib/auth-client';
import { signInMessage } from '@/lib/sign-in-messages';

const DEMO_BUTTONS = [
  { account: 'ADMIN', label: 'Quản trị viên' },
  { account: 'GV001', label: 'Cố vấn học tập GV001' },
  { account: 'GV002', label: 'Cố vấn học tập GV002' },
] as const;

interface LoginPanelProps {
  errorCode: string | null;
  googleEnabled: boolean;
  demoMode: boolean;
  demoEmail: string | null;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function StudentTab({ googleEnabled }: { googleEnabled: boolean }) {
  const [pending, setPending] = useState(false);

  if (!googleEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Đăng nhập bằng Google chưa được cấu hình. Quản trị viên cần khai báo mã ứng dụng Google
        (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) rồi khởi động lại hệ thống.
      </p>
    );
  }

  const signInWithGoogle = async () => {
    setPending(true);
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
      errorCallbackURL: '/login',
    });
    setPending(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Dùng email sinh viên <strong>@student.ctuet.edu.vn</strong>. Hồ sơ của bạn cần được phòng
        Đào tạo nhập trước.
      </p>
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => void signInWithGoogle()}
      >
        {pending && <Loader2 className="animate-spin" />}
        Đăng nhập bằng Google
      </Button>
    </div>
  );
}

const staffSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')),
  password: z.string().min(1, 'Nhập mật khẩu'),
});
type StaffValues = z.infer<typeof staffSchema>;

function StaffTab({ demoMode, demoEmail }: { demoMode: boolean; demoEmail: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [demoPending, setDemoPending] = useState<string | null>(null);
  const form = useForm<StaffValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { email: demoMode && demoEmail ? demoEmail : '', password: '' },
  });

  const onSubmit = async (values: StaffValues) => {
    setError(null);
    const { error: signInError } = await authClient.signIn.email(values);
    if (signInError) {
      setError(signInMessage(signInError.status === 429 ? 'RATE_LIMITED' : signInError.code));
      return;
    }
    router.replace('/');
    router.refresh();
  };

  const quickLogin = async (account: string) => {
    setError(null);
    setDemoPending(account);
    const response = await fetch('/api/auth/demo/quick-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { code?: string } | null;
      setError(signInMessage(body?.code));
      setDemoPending(null);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}
      <Form {...form}>
        <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email cán bộ</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mật khẩu</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Đăng nhập
          </Button>
        </form>
      </Form>
      <p className="text-center text-sm text-muted-foreground">
        Cố vấn học tập chưa có tài khoản?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Đăng ký
        </Link>
      </p>
      {demoMode && (
        <div className="border-t pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
            Đăng nhập nhanh (chế độ demo)
          </p>
          <div className="flex flex-col gap-2">
            {DEMO_BUTTONS.map(({ account, label }) => (
              <Button
                key={account}
                variant="outline"
                disabled={demoPending !== null}
                onClick={() => void quickLogin(account)}
              >
                {demoPending === account && <Loader2 className="animate-spin" />}
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LoginPanel({ errorCode, googleEnabled, demoMode, demoEmail }: LoginPanelProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Đăng nhập</CardTitle>
        <CardDescription>Chọn đúng đối tượng của bạn.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {errorCode && <ErrorBanner message={signInMessage(errorCode)} />}
        <Tabs defaultValue="student">
          <TabsList className="w-full">
            <TabsTrigger value="student">Sinh viên</TabsTrigger>
            <TabsTrigger value="staff">Cán bộ</TabsTrigger>
          </TabsList>
          <TabsContent value="student" className="pt-4">
            <StudentTab googleEnabled={googleEnabled} />
          </TabsContent>
          <TabsContent value="staff" className="pt-4">
            <StaffTab demoMode={demoMode} demoEmail={demoEmail} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
