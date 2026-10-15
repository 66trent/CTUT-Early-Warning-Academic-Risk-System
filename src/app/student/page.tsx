import type { Metadata } from 'next';
import { CircleCheck, Lightbulb, Mail } from 'lucide-react';
import { CourseSnapshotTable } from '@/components/alerts/student-profile-view';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { assertScope } from '@/lib/authz';
import { SOURCE_LABELS } from '@/modules/alerts/services/alert-presentation';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { getStudentOverview } from '@/modules/alerts/services/student-profile.service';

export const metadata: Metadata = { title: 'Tình hình học tập của bạn' };

/**
 * Trang sinh viên — khung tích cực, không dùng "cảnh báo"/"rủi ro" làm tiêu đề, không hiện điểm rủi
 * ro thô; chỉ hiện điều cần chú ý SAU KHI Cố vấn học tập xác nhận (docs/rules/06, 07).
 */
export default async function StudentHomePage() {
  const user = await requireUser([UserRole.STUDENT]);
  await assertScope(user, { studentId: user.userId, resourceType: 'Student' });
  const term = pickTerm(await listTermOptions());
  const overview = term ? await getStudentOverview(user.userId, term.termId) : null;
  const attention = overview?.level === 'NEEDS_ATTENTION';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1>Tình hình học tập của bạn</h1>
        <p className="mt-1 text-muted-foreground">
          Xin chào {user.fullName}
          {term ? ` · ${term.termName}` : ''}
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Tổng quan
            <Badge variant="outline" className="gap-1">
              {attention ? <Lightbulb aria-hidden /> : <CircleCheck aria-hidden />}
              {attention ? 'Cần chú ý' : 'Ổn định'}
            </Badge>
          </CardTitle>
          <CardDescription>
            {attention
              ? 'Cố vấn học tập của bạn đã ghi nhận vài điểm nên cải thiện. Các gợi ý bên dưới có thể giúp bạn.'
              : overview?.resolved
                ? 'Cố vấn học tập đã cùng bạn trao đổi các điểm cần chú ý. Hãy tiếp tục theo kế hoạch đã thống nhất nhé!'
                : 'Bạn đang theo kịp học kỳ. Hãy tiếp tục duy trì nhé!'}
          </CardDescription>
        </CardHeader>
        {overview && overview.focus.length > 0 && (
          <CardContent className="flex flex-col gap-3">
            {overview.focus.map((f, i) => (
              <div key={i} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {SOURCE_LABELS[f.source]} · {f.course}
                </p>
                <p className="mt-1 text-muted-foreground">{f.detail}</p>
                <p className="mt-2 flex gap-2">
                  <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  {f.suggestion}
                </p>
              </div>
            ))}
            <ReferenceOnlyNotice />
          </CardContent>
        )}
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Các học phần trong học kỳ</CardTitle>
        </CardHeader>
        <CardContent>
          <CourseSnapshotTable courses={overview?.profile.courses ?? []} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Cần hỗ trợ?</CardTitle>
          <CardDescription>
            {overview?.advisor
              ? `Cố vấn học tập của bạn: ${overview.advisor.fullName}.`
              : 'Lớp của bạn chưa có Cố vấn học tập phụ trách — hãy liên hệ phòng Đào tạo.'}
          </CardDescription>
        </CardHeader>
        {overview?.advisor && (
          <CardContent>
            <Button asChild className="min-h-11">
              <a href={`mailto:${overview.advisor.email}`}>
                <Mail aria-hidden />
                Liên hệ Cố vấn học tập
              </a>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
