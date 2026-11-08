/**
 * Chuông "dữ liệu vừa cập nhật / đánh giá đã cập nhật" (người dùng chốt 2026-11-08, docs/rules/06, 07):
 * mỗi lần đánh giá xong → 1 thông báo cho mỗi Admin đang hoạt động + mỗi Cố vấn học tập có lớp liên
 * quan (lớp có cảnh báo mới / mở lại / tăng mức, hoặc có sinh viên học phần vừa nạp dữ liệu). Chỉ
 * trong ứng dụng; nội dung là số đếm + tên học phần, không có dữ liệu cá nhân sinh viên.
 */
import { In, IsNull } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Alert } from '@/db/entities/alert.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { Student } from '@/db/entities/student.entity';
import { UpdateNotification } from '@/db/entities/update-notification.entity';
import { User } from '@/db/entities/user.entity';
import { EvaluationTrigger, type NotificationEvent, UserAccountStatus, UserRole } from '@/db/enums';
import {
  describeImportBatch,
  type ImportDescription,
} from '@/modules/data-import/services/import-describe.service';
import { type AlertEvent } from './alert-sync.service';

type Counts = Record<NotificationEvent, number>;
const emptyCounts = (): Counts => ({ CREATED: 0, REOPENED: 0, SEVERITY_INCREASED: 0 });

/** "1 cảnh báo mới · 1 tăng mức" — không có gì → "không có thay đổi cảnh báo". */
export function describeCounts(c: Counts): string {
  const parts = [
    c.CREATED ? `${c.CREATED} cảnh báo mới` : '',
    c.REOPENED ? `${c.REOPENED} mở lại` : '',
    c.SEVERITY_INCREASED ? `${c.SEVERITY_INCREASED} tăng mức` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'không có thay đổi cảnh báo';
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Tiêu đề theo nguồn kích hoạt (thuần — test được). */
export function updateTitle(
  run: Pick<EvaluationRun, 'trigger' | 'courseId'>,
  data: ImportDescription | null,
): string {
  if (run.trigger === EvaluationTrigger.AUTO_AFTER_IMPORT && data) {
    const what = `${data.dataTypes.join(', ')}${data.courseNames.length ? ` — ${data.courseNames.join(', ')}` : ''}`;
    return clip(`${data.source === 'MOODLE' ? 'Moodle' : 'Nạp file'}: ${what} vừa cập nhật`, 200);
  }
  switch (run.trigger) {
    case EvaluationTrigger.AUTO_AFTER_IMPORT:
      return 'Đánh giá lại sau khi dữ liệu thay đổi';
    case EvaluationTrigger.MANUAL:
      return run.courseId ? `Admin chạy đánh giá học phần ${run.courseId}` : 'Admin chạy đánh giá';
    case EvaluationTrigger.SCHEDULED:
      return 'Đánh giá tự động theo lịch';
    case EvaluationTrigger.TERM_CLOSING:
      return 'Chốt học kỳ — đánh giá lần cuối';
  }
}

/** Lớp → số sự kiện cảnh báo của lớp. */
async function countsByClass(events: readonly AlertEvent[]): Promise<Map<string, Counts>> {
  const byClass = new Map<string, Counts>();
  if (events.length === 0) return byClass;
  const ds = await getDataSource();
  const alerts = await ds.getRepository(Alert).find({
    select: { alertId: true, studentId: true },
    where: { alertId: In(events.map((e) => e.alertId)) },
  });
  const students = await ds.getRepository(Student).find({
    select: { studentId: true, classId: true },
    where: { studentId: In(alerts.map((a) => a.studentId)) },
  });
  const classOf = new Map(students.map((s) => [s.studentId, s.classId]));
  const studentOf = new Map(alerts.map((a) => [a.alertId, a.studentId]));
  for (const e of events) {
    const classId = classOf.get(studentOf.get(e.alertId) ?? '');
    if (!classId) continue;
    const counts = byClass.get(classId) ?? emptyCounts();
    counts[e.event] += 1;
    byClass.set(classId, counts);
  }
  return byClass;
}

/** Lớp có sinh viên học các học phần vừa nạp dữ liệu (trong học kỳ của lần chạy). */
async function classesOfCourses(termId: string, courseIds: string[]): Promise<string[]> {
  if (courseIds.length === 0) return [];
  const rows = await (
    await getDataSource()
  )
    .getRepository(Enrollment)
    .createQueryBuilder('e')
    .innerJoin(Student, 's', 's.student_id = e.student_id')
    .select('DISTINCT s.class_id', 'classId')
    .where('e.term_id = :termId', { termId })
    .andWhere('e.course_id IN (:...courseIds)', { courseIds })
    .getRawMany<{ classId: string }>();
  return rows.map((r) => r.classId);
}

/**
 * Lần đánh giá xong → thông báo chuông. Idempotent (UNIQUE lần chạy + người nhận). Trả số thông báo.
 */
export async function notifyEvaluationCompleted(
  runId: string,
  events: readonly AlertEvent[],
): Promise<number> {
  const ds = await getDataSource();
  const run = await ds.getRepository(EvaluationRun).findOneBy({ id: runId });
  if (!run) return 0;
  const data = run.importBatchId ? await describeImportBatch(run.importBatchId) : null;
  const title = updateTitle(run, data);
  const byClass = await countsByClass(events);
  const total = emptyCounts();
  for (const c of byClass.values())
    for (const k of Object.keys(c) as NotificationEvent[]) total[k] += c[k];

  const rows: Partial<UpdateNotification>[] = [];
  const base = { evaluationRunId: run.id, termId: run.termId, title };
  const admins = await ds.getRepository(User).find({
    select: { userId: true },
    where: { role: UserRole.ADMIN, accountStatus: UserAccountStatus.ACTIVE },
  });
  for (const admin of admins) {
    rows.push({
      ...base,
      recipientId: admin.userId,
      body: clip(`Đánh giá xong ${run.totalStudents} sinh viên · ${describeCounts(total)}`, 300),
      link: `/admin/evaluations/${run.id}`,
    });
  }

  const classIds = [
    ...new Set([...byClass.keys(), ...(await classesOfCourses(run.termId, data?.courseIds ?? []))]),
  ];
  const classes = classIds.length
    ? await ds.getRepository(AdministrativeClass).find({ where: { classId: In(classIds) } })
    : [];
  const byAdvisor = new Map<string, string[]>();
  for (const c of classes) {
    if (c.advisorId) byAdvisor.set(c.advisorId, [...(byAdvisor.get(c.advisorId) ?? []), c.classId]);
  }
  const advisors = byAdvisor.size
    ? await ds.getRepository(User).find({
        select: { userId: true },
        where: {
          userId: In([...byAdvisor.keys()]),
          role: UserRole.ADVISOR,
          accountStatus: UserAccountStatus.ACTIVE,
        },
      })
    : [];
  for (const advisor of advisors) {
    const parts = (byAdvisor.get(advisor.userId) ?? [])
      .sort()
      .map((classId) => `Lớp ${classId}: ${describeCounts(byClass.get(classId) ?? emptyCounts())}`);
    rows.push({
      ...base,
      recipientId: advisor.userId,
      body: clip(parts.join('; '), 300),
      link: '/advisor/alerts',
    });
  }
  if (rows.length === 0) return 0;
  const result = await ds
    .createQueryBuilder()
    .insert()
    .into(UpdateNotification)
    .values(rows)
    .orIgnore()
    .execute();
  return result.identifiers.filter(Boolean).length;
}

export interface UpdateNotificationDto {
  id: string;
  title: string;
  body: string;
  link: string;
  createdAt: string;
  read: boolean;
}

export async function listUpdateNotifications(
  userId: string,
  take = 20,
): Promise<{ items: UpdateNotificationDto[]; unread: number }> {
  const repo = (await getDataSource()).getRepository(UpdateNotification);
  const [rows, unread] = await Promise.all([
    repo.find({ where: { recipientId: userId }, order: { createdAt: 'DESC' }, take }),
    repo.countBy({ recipientId: userId, readAt: IsNull() }),
  ]);
  return {
    items: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: n.createdAt.toISOString(),
      read: n.readAt !== null,
    })),
    unread,
  };
}

/** Đánh dấu đã đọc — chỉ của chính người nhận (`id` NULL = tất cả). */
export async function markUpdateNotificationsRead(userId: string, id?: string): Promise<void> {
  await (
    await getDataSource()
  )
    .createQueryBuilder()
    .update(UpdateNotification)
    .set({ readAt: new Date() })
    .where('recipient_id = :userId AND read_at IS NULL', { userId })
    .andWhere(id ? 'id = :id' : '1 = 1', { id })
    .execute();
}
