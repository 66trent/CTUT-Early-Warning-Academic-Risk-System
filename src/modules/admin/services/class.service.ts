import { type EntityManager } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Alert } from '@/db/entities/alert.entity';
import { Department } from '@/db/entities/department.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import {
  applyOrder,
  firstPage,
  type ListParams,
  type Paged,
  pageOffset,
  resolveSort,
} from '@/lib/list-params';
import {
  type ChangeAdvisor,
  type ClassFilter,
  type CreateClass,
  type UpdateClass,
} from '../validators/class';
import { ACTIVE_ALERT_STATUSES } from './overview.service';
import { escapeLike } from './student-search.service';
import {
  studentIdsOfClass,
  transferOpenAlerts,
} from '@/modules/alerts/services/alert-lifecycle.service';

export interface DepartmentDto {
  departmentId: string;
  departmentName: string;
  classCount: number;
}

export interface ClassDto {
  classId: string;
  className: string;
  departmentId: string;
  departmentName: string;
  cohortYear: string;
  advisorId: string | null;
  advisorName: string | null;
  studentCount: number;
}

export interface DepartmentSummaryDto extends DepartmentDto {
  studentCount: number;
}

export interface ClassListItemDto extends ClassDto {
  /** Cảnh báo chưa đóng của học kỳ hiện tại; null khi chưa đặt học kỳ hiện tại. */
  openAlerts: number | null;
}

export const CLASS_SORT_KEYS = ['classId', 'cohortYear', 'departmentId', 'advisorName'] as const;
export type ClassSortKey = (typeof CLASS_SORT_KEYS)[number];
export const CLASS_DEFAULT_SORT = { sort: 'cohortYear', dir: 'desc' } as const;
const CLASS_SORT_COLUMNS: Record<ClassSortKey, string> = {
  classId: 'c.classId',
  cohortYear: 'c.cohortYear',
  departmentId: 'c.departmentId',
  advisorName: 'u.fullName',
};

export interface AdvisorOptionDto {
  userId: string;
  fullName: string;
}

/** Số lượng theo nhóm bằng COUNT … GROUP BY tường minh (docs/rules/01 — không dùng loadRelationCountAndMap). */
async function countBy(
  em: EntityManager,
  entity: typeof Student | typeof AdministrativeClass,
  column: 'classId' | 'departmentId',
): Promise<Map<string, number>> {
  const rows = await em
    .getRepository(entity)
    .createQueryBuilder('t')
    .select(`t.${column}`, 'key')
    .addSelect('COUNT(*)', 'total')
    .groupBy(`t.${column}`)
    .getRawMany<{ key: string; total: string }>();
  return new Map(rows.map((r) => [r.key, Number(r.total)]));
}

export async function listDepartments(): Promise<DepartmentDto[]> {
  const { manager } = await getDataSource();
  const [departments, classCounts] = await Promise.all([
    manager.find(Department, { order: { departmentId: 'ASC' } }),
    countBy(manager, AdministrativeClass, 'departmentId'),
  ]);
  return departments.map((d) => ({
    departmentId: d.departmentId,
    departmentName: d.departmentName,
    classCount: classCounts.get(d.departmentId) ?? 0,
  }));
}

export async function listClasses(): Promise<ClassDto[]> {
  const { manager } = await getDataSource();
  const [classes, studentCounts] = await Promise.all([
    manager.find(AdministrativeClass, {
      relations: { department: true, advisor: true },
      order: { classId: 'ASC' },
      take: 500,
    }),
    countBy(manager, Student, 'classId'),
  ]);
  return classes.map((c) => ({
    classId: c.classId,
    className: c.className,
    departmentId: c.departmentId,
    departmentName: c.department?.departmentName ?? c.departmentId,
    cohortYear: c.cohortYear,
    advisorId: c.advisorId,
    advisorName: c.advisor?.fullName ?? null,
    studentCount: studentCounts.get(c.classId) ?? 0,
  }));
}

/** CVHT có thể gán cho lớp: vai trò ADVISOR, trạng thái ACTIVE (docs/rules/09). */
export async function listAssignableAdvisors(): Promise<AdvisorOptionDto[]> {
  const repo = (await getDataSource()).getRepository(User);
  const advisors = await repo.find({
    select: { userId: true, fullName: true },
    where: { role: UserRole.ADVISOR, accountStatus: UserAccountStatus.ACTIVE },
    order: { fullName: 'ASC' },
    take: 500,
  });
  return advisors.map((a) => ({ userId: a.userId, fullName: a.fullName }));
}

async function assertAssignableAdvisor(em: EntityManager, advisorId: string | null): Promise<void> {
  if (advisorId === null) return;
  const ok = await em.existsBy(User, {
    userId: advisorId,
    role: UserRole.ADVISOR,
    accountStatus: UserAccountStatus.ACTIVE,
  });
  if (!ok) {
    throw new AppError('ADVISOR_NOT_ASSIGNABLE', 'Chỉ gán được Cố vấn học tập đang hoạt động.');
  }
}

async function assertDepartmentExists(em: EntityManager, departmentId: string): Promise<void> {
  if (!(await em.existsBy(Department, { departmentId }))) {
    throw new AppError('DEPARTMENT_NOT_FOUND', 'Khoa không tồn tại.');
  }
}

export async function createClass(input: CreateClass, actorId: string): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    if (await em.existsBy(AdministrativeClass, { classId: input.classId })) {
      throw new AppError('CLASS_EXISTS', `Lớp ${input.classId} đã có trong hệ thống.`);
    }
    await assertDepartmentExists(em, input.departmentId);
    await assertAssignableAdvisor(em, input.advisorId);
    await em.insert(AdministrativeClass, input);
    await writeAuditLog(
      {
        actorId,
        action: 'CLASS_CREATED',
        targetType: 'AdministrativeClass',
        targetId: input.classId,
        detail: { departmentId: input.departmentId, advisorId: input.advisorId },
      },
      em,
    );
  });
}

export async function updateClass(input: UpdateClass, actorId: string): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    await assertDepartmentExists(em, input.departmentId);
    const { classId, ...changes } = input;
    const result = await em.update(AdministrativeClass, { classId }, changes);
    if (!result.affected) throw new AppError('CLASS_NOT_FOUND', 'Không tìm thấy lớp.');
    await writeAuditLog(
      {
        actorId,
        action: 'CLASS_UPDATED',
        targetType: 'AdministrativeClass',
        targetId: classId,
        detail: changes,
      },
      em,
    );
  });
}

/**
 * Gán/đổi CVHT của lớp trong 1 transaction + Audit Log (docs/rules/06, 09).
 * Chuyển các cảnh báo đang mở của lớp sang Cố vấn học tập mới trong CÙNG transaction (docs/rules/09)
 * — kể cả khi lớp trước đó chưa có người phụ trách.
 */
export async function changeClassAdvisor(input: ChangeAdvisor, actorId: string): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (em) => {
    const current = await em.findOne(AdministrativeClass, {
      select: { classId: true, advisorId: true },
      where: { classId: input.classId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!current) throw new AppError('CLASS_NOT_FOUND', 'Không tìm thấy lớp.');
    if (current.advisorId === input.advisorId) return;
    await assertAssignableAdvisor(em, input.advisorId);
    await em.update(
      AdministrativeClass,
      { classId: input.classId },
      { advisorId: input.advisorId },
    );
    await writeAuditLog(
      {
        actorId,
        action: 'CLASS_ADVISOR_CHANGED',
        targetType: 'AdministrativeClass',
        targetId: input.classId,
        detail: { fromAdvisorId: current.advisorId, toAdvisorId: input.advisorId },
      },
      em,
    );
    await transferOpenAlerts(
      em,
      await studentIdsOfClass(em, input.classId),
      input.advisorId,
      actorId,
    );
  });
}

/** Khoa kèm số lớp + số sinh viên — hàng chip lọc trên trang Khoa và lớp. */
export async function listDepartmentSummaries(): Promise<DepartmentSummaryDto[]> {
  const { manager } = await getDataSource();
  const [departments, studentRows] = await Promise.all([
    listDepartments(),
    manager
      .getRepository(Student)
      .createQueryBuilder('s')
      .innerJoin(AdministrativeClass, 'c', 'c.classId = s.classId')
      .select('c.departmentId', 'departmentId')
      .addSelect('COUNT(*)', 'total')
      .groupBy('c.departmentId')
      .getRawMany<{ departmentId: string; total: string }>(),
  ]);
  const students = new Map(studentRows.map((r) => [r.departmentId, Number(r.total)]));
  return departments.map((d) => ({ ...d, studentCount: students.get(d.departmentId) ?? 0 }));
}

/** Các khóa (năm nhập học) đang có lớp — ô lọc khóa. Mới nhất trước. */
export async function listCohortYears(): Promise<string[]> {
  const rows = await (
    await getDataSource()
  )
    .getRepository(AdministrativeClass)
    .createQueryBuilder('c')
    .select('DISTINCT c.cohortYear', 'cohortYear')
    .orderBy('c.cohortYear', 'DESC')
    .getRawMany<{ cohortYear: string }>();
  return rows.map((r) => r.cohortYear);
}

/** Cảnh báo chưa đóng của học kỳ hiện tại theo lớp — COUNT … GROUP BY (docs/rules/01). */
async function countOpenAlertsByClass(
  em: EntityManager,
  classIds: string[],
): Promise<Map<string, number> | null> {
  const term = await em.getRepository(Term).findOneBy({ isCurrent: true });
  if (!term) return null;
  if (classIds.length === 0) return new Map();
  const rows = await em
    .getRepository(Alert)
    .createQueryBuilder('a')
    .innerJoin(Student, 's', 's.studentId = a.studentId')
    .select('s.classId', 'classId')
    .addSelect('COUNT(*)', 'total')
    .where('a.termId = :termId', { termId: term.termId })
    .andWhere('a.status IN (:...statuses)', { statuses: ACTIVE_ALERT_STATUSES })
    .andWhere('s.classId IN (:...classIds)', { classIds })
    .groupBy('s.classId')
    .getRawMany<{ classId: string; total: string }>();
  return new Map(rows.map((r) => [r.classId, Number(r.total)]));
}

/**
 * Lớp sinh hoạt có lọc (khoa, khóa, "chưa có CVHT", tìm mã lớp / tên lớp / tên CVHT) + phân trang.
 * Mặc định khóa mới trước.
 */
export async function searchClasses(
  filter: ClassFilter,
  list: ListParams<ClassSortKey> = firstPage(CLASS_DEFAULT_SORT),
): Promise<Paged<ClassListItemDto>> {
  const { manager } = await getDataSource();
  const qb = manager
    .getRepository(AdministrativeClass)
    .createQueryBuilder('c')
    .leftJoinAndSelect('c.department', 'd')
    .leftJoinAndSelect('c.advisor', 'u');
  if (filter.department) qb.andWhere('c.departmentId = :dep', { dep: filter.department });
  if (filter.cohort) qb.andWhere('c.cohortYear = :cohort', { cohort: filter.cohort });
  if (filter.noAdvisor) qb.andWhere('c.advisorId IS NULL');
  if (filter.q) {
    qb.andWhere('(c.classId ILIKE :q OR c.className ILIKE :q OR u.fullName ILIKE :q)', {
      q: `%${escapeLike(filter.q)}%`,
    });
  }
  const order = resolveSort(list, CLASS_DEFAULT_SORT);
  applyOrder(qb, CLASS_SORT_COLUMNS[order.sort], order.dir, ['c.classId', 'ASC']);
  // Join nhiều–1 (khoa, CVHT) không nhân dòng → offset/limit thẳng (bẫy #24).
  qb.offset(pageOffset(list)).limit(list.size);
  const [classes, total] = await qb.getManyAndCount();
  const ids = classes.map((c) => c.classId);
  const [studentCounts, alerts] = await Promise.all([
    countStudentsOfClasses(manager, ids),
    countOpenAlertsByClass(manager, ids),
  ]);
  return {
    items: classes.map((c) => ({
      classId: c.classId,
      className: c.className,
      departmentId: c.departmentId,
      departmentName: c.department?.departmentName ?? c.departmentId,
      cohortYear: c.cohortYear,
      advisorId: c.advisorId,
      advisorName: c.advisor?.fullName ?? null,
      studentCount: studentCounts.get(c.classId) ?? 0,
      openAlerts: alerts ? (alerts.get(c.classId) ?? 0) : null,
    })),
    total,
    page: list.page,
    size: list.size,
  };
}

async function countStudentsOfClasses(
  em: EntityManager,
  classIds: string[],
): Promise<Map<string, number>> {
  if (classIds.length === 0) return new Map();
  const rows = await em
    .getRepository(Student)
    .createQueryBuilder('s')
    .select('s.classId', 'classId')
    .addSelect('COUNT(*)', 'total')
    .where('s.classId IN (:...classIds)', { classIds })
    .groupBy('s.classId')
    .getRawMany<{ classId: string; total: string }>();
  return new Map(rows.map((r) => [r.classId, Number(r.total)]));
}
