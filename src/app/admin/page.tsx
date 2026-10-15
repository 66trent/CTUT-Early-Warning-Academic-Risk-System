import type { Metadata } from 'next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth-server';
import { UserRole } from '@/db/enums';

export const metadata: Metadata = { title: 'Tổng quan' };

export default async function AdminHomePage() {
  const user = await requireUser([UserRole.ADMIN]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1>Tổng quan</h1>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Xin chào {user.fullName}</CardTitle>
          <CardDescription>
            Số liệu tổng quan sẽ hiển thị khi đã có học kỳ, lớp sinh hoạt và dữ liệu sinh viên.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
