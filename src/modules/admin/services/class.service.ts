import { type EntityManager } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Department } from '@/db/entities/department.entity';
import { Student } from '@/db/entities/student.entity';
import { User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { writeAuditLog } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { type ChangeAdvisor, type CreateClass, type UpdateClass } from '../validators/class';

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
 * Phase 5 bổ sung: chuyển `Alert.assignedAdvisorId` của các cảnh báo đang mở trong cùng transaction.
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
  });
}
