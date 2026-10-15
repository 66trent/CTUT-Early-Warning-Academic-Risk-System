import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME, UNIVERSITY_NAME } from '@/lib/app-config';

/** Trang gốc tạm thời. Từ khi có đăng nhập: chuyển hướng theo vai trò. */
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-workspace p-4">
      <Card className="w-full max-w-md text-center shadow-sm">
        <CardHeader className="items-center">
          <Image src="/logo.png" alt="" width={72} height={72} className="mx-auto" priority />
          <CardTitle className="text-2xl text-accent-strong">{APP_NAME}</CardTitle>
          <CardDescription>{UNIVERSITY_NAME}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Hệ thống cảnh báo sớm rủi ro học tập đang được thiết lập.
        </CardContent>
      </Card>
    </main>
  );
}
