import type { Metadata } from 'next';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Cảnh báo cần xử lý' };

/** Màn hình mặc định của Cố vấn học tập: danh sách cảnh báo cần hành động (docs/rules/07). */
export default function AdvisorHomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1>Cảnh báo cần xử lý</h1>
        <div className="mt-1">
          <ReferenceOnlyNotice />
        </div>
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Chưa có sinh viên nào cần chú ý trong học kỳ này</CardTitle>
          <CardDescription>
            Khi hệ thống phát hiện dấu hiệu cần hỗ trợ, sinh viên sẽ xuất hiện tại đây.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
