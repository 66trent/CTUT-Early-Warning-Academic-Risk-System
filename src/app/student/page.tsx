import type { Metadata } from 'next';
import { Lightbulb, Mail } from 'lucide-react';
import { StudentCourseCards } from '@/components/alerts/student-course-cards';
import { StatCard } from '@/components/dashboard/dashboard-parts';
import { QuickGuide } from '@/components/quick-guide';
import { ReferenceOnlyNotice } from '@/components/domain/reference-only-notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/db/enums';
import { requireUser } from '@/lib/auth-server';
import { assertScope } from '@/lib/authz';
import { STUDENT_GUIDE } from '@/modules/alerts/guide-content';
import { SOURCE_LABELS } from '@/modules/alerts/services/alert-presentation';
import { listTermOptions, pickTerm } from '@/modules/alerts/services/alert-terms';
import { getStudentOverview } from '@/modules/alerts/services/student-profile.service';
import { getAttendanceThreshold } from '@/modules/rule-engine/services/student-academic.service';

export const metadata: Metadata = { title: 'Tình hình học tập của bạn' };

/**
 * Trang sinh viên — khung tích cực, không dùng "cảnh báo"/"rủi ro" làm tiêu đề, không hiện điểm rủi
 * ro thô; chỉ hiện điều cần chú ý SAU KHI Cố vấn học tập xác nhận (docs/rules/06, 07).
 */
export default async function StudentHomePage() {
  const user = await requireUser([UserRole.STUDENT]);
  await assertScope(user, { studentId: user.userId, resourceType: 'Student' });
  const term = pickTerm(await listTermOptions());
  const [overview, threshold] = await Promise.all([
    term ? getStudentOverview(user.userId, term.termId) : null,
    getAttendanceThreshold(),
  ]);
  const courses = overview?.profile.courses ?? [];
  const work = courses.reduce(
    (sum, c) => ({
      done: sum.done + c.quizzes.submitted + c.assignments.submitted,
      total: sum.total + c.quizzes.total + c.assignments.total,
    }),
    { done: 0, total: 0 },
  );
  const graded = courses.filter((c) => c.result).length;
  const focus = overview?.focus ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1>Tình hình học tập của bạn</h1>
        <p className="mt-1 text-muted-foreground">
          Xin chào {user.fullName}
          {term ? ` · ${term.termName}` : ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Học phần trong học kỳ" value={courses.length} tone="hero" />
        <StatCard label="Bài đã hoàn thành" value={work.done} suffix={`/ ${work.total}`} />
        <StatCard label="Học phần đã có kết quả" value={graded} suffix={`/ ${courses.length}`} />
      </div>

      {focus.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Việc nên làm</CardTitle>
            <CardDescription>
              Cố vấn học tập của bạn đã ghi nhận vài điểm nên cải thiện.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {focus.map((f, i) => (
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
        </Card>
      )}
      {focus.length === 0 && overview?.resolved && (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
          Cố vấn học tập đã cùng bạn trao đổi các điểm cần chú ý. Tiếp tục theo kế hoạch đã thống
          nhất nhé.
        </p>
      )}

      <QuickGuide guide={STUDENT_GUIDE} storageKey="ewars:guide:student" />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Các học phần trong học kỳ</CardTitle>
          <CardDescription>
            Số liệu lấy theo lần nhập dữ liệu gần nhất của nhà trường.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentCourseCards courses={courses} threshold={threshold} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Cần hỗ trợ?</CardTitle>
          <CardDescription>
            {overview?.advisor
              ? `Cố vấn học tập của bạn: ${overview.advisor.fullName}.`
              : 'Lớp của bạn chưa có Cố vấn học tập phụ trách, hãy liên hệ phòng Đào tạo.'}
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
