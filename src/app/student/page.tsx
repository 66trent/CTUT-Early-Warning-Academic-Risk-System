import type { Metadata } from 'next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth-server';
import { UserRole } from '@/db/enums';

export const metadata: Metadata = { title: 'Tình hình học tập của bạn' };

/** Trang sinh viên — khung tích cực, không dùng từ "cảnh báo"/"rủi ro" làm tiêu đề (docs/rules/07). */
export default async function StudentHomePage() {
  const user = await requireUser([UserRole.STUDENT]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1>Tình hình học tập của bạn</h1>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Xin chào {user.fullName}</CardTitle>
          <CardDescription>
            Thông tin học tập của bạn sẽ hiển thị tại đây khi học kỳ có dữ liệu.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
