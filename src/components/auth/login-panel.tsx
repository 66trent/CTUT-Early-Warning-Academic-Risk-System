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
import { DEMO_CLASS_ACCOUNTS, demoStudentOf } from '@/lib/demo-accounts';
import { signInMessage } from '@/lib/sign-in-messages';

/** Đăng nhập nhanh theo lớp demo (Phase 9a): mỗi lớp 1 Cố vấn học tập + 1 sinh viên tiêu biểu. */
const DEMO_ROWS = DEMO_CLASS_ACCOUNTS.map((c) => ({
  classId: c.classId,
  majorName: c.majorName,
  advisorId: c.advisorId,
  studentId: demoStudentOf(c.classId),
}));

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

function DemoButton({
  account,
  label,
  ariaLabel,
  pending,
  onClick,
}: {
  account: string;
  label: string;
  ariaLabel?: string;
  pending: string | null;
  onClick: (account: string) => Promise<void>;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={pending !== null}
      onClick={() => void onClick(account)}
    >
      {pending === account && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}

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
            <DemoButton
              account="ADMIN"
              label="Quản trị viên"
              pending={demoPending}
              onClick={quickLogin}
            />
            <ul className="flex flex-col gap-2" aria-label="Lớp demo">
              {DEMO_ROWS.map((row) => (
                <li
                  key={row.classId}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2"
                >
                  <span className="flex min-w-0 flex-col text-sm">
                    <span className="font-medium">{row.classId}</span>
                    <span className="truncate text-xs text-muted-foreground">{row.majorName}</span>
                  </span>
                  <DemoButton
                    account={row.advisorId}
                    label={row.advisorId}
                    ariaLabel={`Cố vấn học tập ${row.advisorId}`}
                    pending={demoPending}
                    onClick={quickLogin}
                  />
                  <DemoButton
                    account={row.studentId}
                    label="Sinh viên"
                    ariaLabel={`Sinh viên ${row.studentId}`}
                    pending={demoPending}
                    onClick={quickLogin}
                  />
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Sinh viên đăng nhập được khi đã có hồ sơ (sau khi nạp danh sách sinh viên).
            </p>
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
