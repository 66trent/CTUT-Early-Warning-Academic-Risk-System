import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatVnDateTime } from '@/lib/dates';
import type { ImportCourseCard } from '@/db/entities/import-batch.entity';

/** `YYYY-MM-DD` → `dd/mm/yyyy`. */
const dmy = (date: string) => date.split('-').reverse().join('/');

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function CourseCard({ card, staged }: { card: ImportCourseCard; staged: boolean }) {
  const departments = [...new Set(card.classes.map((c) => c.departmentId))];
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-md border bg-background p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen aria-hidden className="size-4 shrink-0 text-primary" />
          <h3 className="font-semibold">{card.courseName}</h3>
        </div>
        {staged && card.isNew ? (
          <Badge variant="unstyled" className="border-transparent bg-primary-soft text-primary">
            Học phần mới, sẽ tạo
          </Badge>
        ) : (
          <Badge variant="outline">Đã có trong hệ thống</Badge>
        )}
      </header>
      <dl className="flex flex-col gap-1.5">
        <Row label="Lớp học phần">{card.sectionCodes.join(', ')}</Row>
        <Row label="Mã học phần">
          {card.courseId}
          {card.derivedCode && (
            <span className="text-muted-foreground"> (tự suy: bỏ 2 số cuối mã lớp học phần)</span>
          )}
        </Row>
        {card.snapshotDates && (
          <Row label="Điểm danh">
            {card.totalPeriods ? `${card.totalPeriods} tiết · ` : ''}ngày chốt{' '}
            {card.snapshotDates.map(dmy).join(', ')}
            {card.previousSnapshotDate && (
              <span className="block text-xs text-muted-foreground">
                Lần nạp trước: chốt {dmy(card.previousSnapshotDate)}
              </span>
            )}
          </Row>
        )}
        {card.activities && (
          <Row label="Bài LMS">
            <ul className="flex flex-col gap-0.5">
              {card.activities.map((a) => (
                <li key={a.key}>
                  {a.name}
                  <span className="text-muted-foreground">
                    {a.dueAt ? ` · hạn ${formatVnDateTime(a.dueAt)}` : ' · không có hạn nộp'}
                  </span>
                </li>
              ))}
            </ul>
          </Row>
        )}
        {card.publishedDates && (
          <Row label="Kết quả">
            {card.credits ? `${card.credits} tín chỉ` : 'chưa có số tín chỉ'}
            {card.publishedDates.length > 0 &&
              ` · công bố ${card.publishedDates.map(dmy).join(', ')}`}
          </Row>
        )}
        <Row label="Sinh viên">
          {card.studentCount} sinh viên
          {card.classes.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              Lớp {card.classes.map((c) => `${c.classId} (${c.count})`).join(', ')} · khoa{' '}
              {departments.join(', ')}
            </span>
          )}
        </Row>
        <Row label="Số dòng">
          <span className="tabular-nums">
            {card.validRows} hợp lệ
            {card.errorRows > 0 && (
              <span className="text-destructive"> · {card.errorRows} lỗi</span>
            )}
            {card.warningRows > 0 && (
              <span className="text-amber-700 dark:text-amber-300">
                {' '}
                · {card.warningRows} cảnh báo
              </span>
            )}
          </span>
        </Row>
      </dl>
    </article>
  );
}

/** Thẻ nhận diện học phần trong file — để Admin thấy rõ đang nạp gì (docs/rules/12). */
export function CourseCards({ cards, staged }: { cards: ImportCourseCard[]; staged: boolean }) {
  if (cards.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {cards.map((card) => (
        <CourseCard key={card.courseId} card={card} staged={staged} />
      ))}
    </div>
  );
}
