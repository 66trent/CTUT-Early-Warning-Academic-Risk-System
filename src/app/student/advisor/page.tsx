import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { getStudentOverview } from '@/modules/alerts/services/student-profile.service';

export const metadata: Metadata = { title: 'Liên hệ Cố vấn học tập' };

export default async function StudentAdvisorPage() {
  const user = await requireUser([UserRole.STUDENT]);
  const term = pickTerm(await listTermOptions());
  const overview = term ? await getStudentOverview(user.userId, term.termId) : null;
  const advisor = overview?.advisor ?? null;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1>Liên hệ Cố vấn học tập</h1>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{advisor ? advisor.fullName : 'Chưa có Cố vấn học tập phụ trách'}</CardTitle>
          <CardDescription>
            {advisor
              ? 'Bạn có thể trao đổi về kế hoạch học tập, việc vắng học hoặc khó khăn trong học kỳ.'
              : 'Hãy liên hệ phòng Đào tạo để được hướng dẫn.'}
          </CardDescription>
        </CardHeader>
        {advisor && (
          <CardContent>
            <Button asChild className="min-h-11">
              <a href={`mailto:${advisor.email}`}>
                <Mail aria-hidden />
                Gửi email cho {advisor.fullName}
              </a>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
