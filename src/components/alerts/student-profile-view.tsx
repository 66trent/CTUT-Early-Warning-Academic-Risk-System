import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CourseResultStatus, EnrollmentStatus } from '@/db/enums';
import { formatVnDate } from '@/lib/dates';
import type { CourseSnapshotDto } from '@/modules/alerts/services/student-profile.service';
import { WithdrawToggle } from './withdraw-toggle';

const score = (v: number | null) => (v === null ? '—' : v.toLocaleString('vi-VN'));

const percent = (a: number, b: number) =>
  b > 0 ? `${(Math.round((a / b) * 1000) / 10).toLocaleString('vi-VN')}%` : '—';

/**
 * Số liệu từng học phần của 1 sinh viên trong học kỳ (Cố vấn học tập, Admin, chính sinh viên).
 * `manageStudentId`: chỉ Admin, học kỳ chưa chốt — hiện nút đánh dấu rút học phần.
 */
export function CourseSnapshotTable({
  courses,
  manageStudentId,
}: {
  courses: CourseSnapshotDto[];
  manageStudentId?: string;
}) {
  const columns = manageStudentId ? 5 : 4;
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Học phần</TableHead>
            <TableHead>Điểm danh</TableHead>
            <TableHead>Bài kiểm tra đã nộp</TableHead>
            <TableHead>Kết quả</TableHead>
            {manageStudentId && <TableHead>Đăng ký</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns} className="text-center text-muted-foreground">
                Chưa có dữ liệu học tập trong học kỳ này.
              </TableCell>
            </TableRow>
          )}
          {courses.map((c) => (
            <TableRow key={c.courseId} className="even:bg-muted">
              <TableCell>
                <span className="font-medium">{c.courseName}</span>
                {c.enrollmentStatus === EnrollmentStatus.WITHDRAWN && (
                  <Badge variant="outline" className="ml-2">
                    Đã rút
                  </Badge>
                )}
                <span className="block text-xs text-muted-foreground">
                  {c.courseId}
                  {c.credits ? ` · ${c.credits} tín chỉ` : ''}
                  {c.attemptNumber > 1 ? ` · học lần ${c.attemptNumber}` : ''}
                </span>
              </TableCell>
              <TableCell className="tabular-nums">
                {c.attendance ? (
                  <>
                    Vắng {c.attendance.absences}/{c.attendance.denominator} (
                    {percent(c.attendance.absences, c.attendance.denominator)})
                    {c.attendance.late > 0 ? ` · trễ ${c.attendance.late}` : ''}
                    <span className="block text-xs text-muted-foreground">
                      chốt ngày {formatVnDate(c.attendance.snapshotDate)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Chưa có</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {c.quizzesAttempted > 0 ? `${c.quizzesSubmitted}/${c.quizzesAttempted} bài` : '—'}
              </TableCell>
              <TableCell className="tabular-nums">
                {!c.result
                  ? '—'
                  : c.result.status === CourseResultStatus.PROCESS_ONLY
                    ? `Điểm quá trình ${score(c.result.processScore)}`
                    : `Tổng kết ${score(c.result.finalScore)}${c.result.letterGrade ? ` (${c.result.letterGrade})` : ''}`}
              </TableCell>
              {manageStudentId && (
                <TableCell>
                  {c.enrollmentStatus === EnrollmentStatus.COMPLETED ? (
                    <span className="text-xs text-muted-foreground">Đã có điểm cuối kỳ</span>
                  ) : (
                    <WithdrawToggle
                      studentId={manageStudentId}
                      enrollmentId={c.enrollmentId}
                      courseLabel={c.courseId}
                      withdrawn={c.enrollmentStatus === EnrollmentStatus.WITHDRAWN}
                    />
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
