'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { registerAdvisorAction } from '@/modules/admin/actions/register-advisor.action';
import {
  type AdvisorRegistrationInput,
  advisorRegistrationSchema,
} from '@/modules/admin/validators/advisor-registration';

const FIELDS: {
  name: keyof AdvisorRegistrationInput;
  label: string;
  type: string;
  autoComplete: string;
}[] = [
  { name: 'staffCode', label: 'Mã cán bộ', type: 'text', autoComplete: 'off' },
  { name: 'fullName', label: 'Họ và tên', type: 'text', autoComplete: 'name' },
  { name: 'email', label: 'Email cán bộ', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Mật khẩu', type: 'password', autoComplete: 'new-password' },
  {
    name: 'confirmPassword',
    label: 'Nhập lại mật khẩu',
    type: 'password',
    autoComplete: 'new-password',
  },
];

export function RegisterForm({ staffEmailDomain }: { staffEmailDomain: string }) {
  const schema = useMemo(() => advisorRegistrationSchema(staffEmailDomain), [staffEmailDomain]);
  const [error, setError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const form = useForm<AdvisorRegistrationInput>({
    resolver: zodResolver(schema),
    defaultValues: { staffCode: '', fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: AdvisorRegistrationInput) => {
    setError(null);
    const result = await registerAdvisorAction(values);
    if (result.ok) setRegisteredEmail(result.data.email);
    else setError(result.message);
  };

  if (registeredEmail) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <MailCheck aria-hidden className="size-10 text-primary" />
          <CardTitle className="text-2xl">Đã gửi đăng ký</CardTitle>
          <CardDescription>
            Chúng tôi đã gửi liên kết xác minh tới <strong>{registeredEmail}</strong>. Sau khi xác
            minh email, tài khoản cần Quản trị viên duyệt trước khi sử dụng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Về trang đăng nhập</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Đăng ký Cố vấn học tập</CardTitle>
        <CardDescription>
          Tài khoản cần Quản trị viên duyệt trước khi sử dụng. Dùng email cán bộ {staffEmailDomain}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
            className="flex flex-col gap-4"
          >
            {FIELDS.map(({ name, label, type, autoComplete }) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input type={type} autoComplete={autoComplete} {...field} />
                    </FormControl>
                    {name === 'password' && <FormDescription>Tối thiểu 8 ký tự.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              Gửi đăng ký
            </Button>
          </form>
        </Form>
        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
