import { BookOpen, CircleAlert } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { EnrollmentStatus } from '@/db/enums';
import { formatVnDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { CourseSnapshotDto } from '@/modules/alerts/services/student-profile.service';
import type { AttendanceThresholdDto } from '@/modules/rule-engine/services/student-academic.service';

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const fmt = (n: number) => n.toLocaleString('vi-VN');

function attendanceState(
  attendance: NonNullable<CourseSnapshotDto['attendance']>,
  threshold: AttendanceThresholdDto | null,
) {
  const counted = threshold && !threshold.countExcused ? attendance.unexcused : attendance.absences;
  const rate = pct(counted, attendance.totalPeriods);
  const limit = threshold?.percent ?? null;
  return { counted, rate, limit, over: limit !== null && rate > limit };
}

/** Gợi ý hành động của 1 học phần — tông dịu, hướng giải pháp (docs/rules/07). */
function NextStep({ children }: { children: string }) {
  return (
    <p className="rounded-md bg-primary-soft px-3 py-2 text-sm">
      <span className="font-semibold text-accent-strong">Việc nên làm:</span> {children}
    </p>
  );
}

/**
 * Thanh tỷ lệ vắng so với vạch ngưỡng của luật đang áp dụng (không ghi cứng — docs/rules/02).
 * Thang thanh = 2 × ngưỡng để vạch nằm giữa, dễ thấy còn cách bao xa.
 */
function AttendanceBar({
  attendance,
  threshold,
}: {
  attendance: NonNullable<CourseSnapshotDto['attendance']>;
  threshold: AttendanceThresholdDto | null;
}) {
  const { counted, rate, limit, over } = attendanceState(attendance, threshold);
  const scale = limit ? limit * 2 : 100;
  const near = limit !== null && !over && rate >= limit * 0.75;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>
          Vắng <span className="font-medium tabular-nums">{counted}</span>/{attendance.totalPeriods}{' '}
          tiết
        </span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            over && 'text-amber-800 dark:text-amber-300',
            near && 'text-amber-700 dark:text-amber-400',
          )}
        >
          {fmt(rate)}%
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            'h-full rounded-full',
            over ? 'bg-amber-600' : near ? 'bg-amber-400' : 'bg-emerald-500',
          )}
          style={{ width: `${Math.min(100, (rate / scale) * 100)}%` }}
        />
        {limit !== null && (
          <div className="absolute -top-1 h-4.5 w-0.5 bg-foreground/70" style={{ left: '50%' }} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {limit !== null
          ? over
            ? `Đã vượt ${limit}%.`
            : `Vạch giữa là ${limit}%: vắng quá mức này sẽ không được dự thi.`
          : ''}{' '}
        Số liệu chốt ngày {formatVnDate(attendance.snapshotDate)}.
      </p>
    </div>
  );
}

/**
 * Trang sinh viên (docs/rules/07): mỗi học phần 1 thẻ — số liệu thật, lời văn trung tính. Cảnh báo
 * KHÔNG hiện ở đây (chỉ hiện sau khi Cố vấn học tập xác nhận, ở khối "Điều nên chú ý").
 */
export function StudentCourseCards({
  courses,
  threshold,
}: {
  courses: CourseSnapshotDto[];
  threshold: AttendanceThresholdDto | null;
}) {
  if (courses.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Chưa có dữ liệu học tập trong học kỳ này"
        description="Số liệu sẽ hiện ở đây sau khi nhà trường cập nhật điểm danh, bài tập hoặc kết quả học phần."
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {courses.map((c) => {
        const overLimit = c.attendance ? attendanceState(c.attendance, threshold).over : false;
        const failed = c.result ? !c.result.passed : false;
        return (
          <li key={c.courseId} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
            <div>
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {c.courseName}
                {c.enrollmentStatus === EnrollmentStatus.WITHDRAWN && (
                  <Badge variant="outline">Đã rút</Badge>
                )}
                {(overLimit || failed) && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    Cần trao đổi
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {c.courseId}
                {c.credits ? ` · ${c.credits} tín chỉ` : ''}
                {c.attemptNumber > 1 ? ` · học lần ${c.attemptNumber}` : ''}
              </p>
            </div>

            {c.attendance ? (
              <AttendanceBar attendance={c.attendance} threshold={threshold} />
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có số liệu điểm danh.</p>
            )}

            {c.quizzes.total + c.assignments.total > 0 && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {c.quizzes.total > 0 && (
                  <div className="rounded-md bg-muted/60 p-2">
                    <p className="text-xs text-muted-foreground">Bài trắc nghiệm</p>
                    <p className="font-medium tabular-nums">
                      Đã làm {c.quizzes.submitted}/{c.quizzes.total}
                    </p>
                  </div>
                )}
                {c.assignments.total > 0 && (
                  <div className="rounded-md bg-muted/60 p-2">
                    <p className="text-xs text-muted-foreground">Bài thực hành</p>
                    <p className="font-medium tabular-nums">
                      Đã nộp {c.assignments.submitted}/{c.assignments.total}
                    </p>
                    {(c.assignments.late > 0 || c.assignments.overdue > 0) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <CircleAlert aria-hidden className="size-3.5" />
                        {[
                          c.assignments.late > 0 ? `${c.assignments.late} bài nộp trễ` : null,
                          c.assignments.overdue > 0
                            ? `${c.assignments.overdue} bài quá hạn chưa nộp`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-3 border-t pt-3 text-sm">
              {c.result ? (
                <p>
                  Kết quả:{' '}
                  <span
                    className={cn(
                      'font-semibold',
                      !c.result.passed && 'text-amber-800 dark:text-amber-300',
                    )}
                  >
                    {c.result.letterGrade}
                    {c.result.passed ? '' : ' · chưa đạt'}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">Chưa có kết quả (học phần chưa khóa điểm).</p>
              )}
              {failed ? (
                <NextStep>gặp Cố vấn học tập để lên kế hoạch học lại học phần này.</NextStep>
              ) : (
                overLimit && (
                  <NextStep>trao đổi với giảng viên và Cố vấn học tập về số tiết đã vắng.</NextStep>
                )
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
