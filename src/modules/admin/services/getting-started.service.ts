import { type EntityTarget, In, IsNull, type ObjectLiteral } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Alert } from '@/db/entities/alert.entity';
import { AttendanceSummary } from '@/db/entities/attendance-summary.entity';
import { CourseResult } from '@/db/entities/course-result.entity';
import { Department } from '@/db/entities/department.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { LmsQuizAttempt } from '@/db/entities/lms-quiz-attempt.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import {
  AlertStatus,
  CourseResultStatus,
  EvaluationRunStatus,
  UserAccountStatus,
  UserRole,
} from '@/db/enums';
import { buildSetupSteps, type SetupCounts, type SetupStep } from './setup-steps';

/** Đếm dòng dữ liệu nguồn của học kỳ (qua Enrollment — mọi dữ liệu nguồn trỏ qua đây). */
async function countSourceRows<T extends ObjectLiteral>(
  entity: EntityTarget<T>,
  termId: string,
  where?: { sql: string; params: Record<string, unknown> },
): Promise<number> {
  const qb = (await getDataSource())
    .getRepository(entity)
    .createQueryBuilder('r')
    .innerJoin('r.enrollment', 'e')
    .where('e.termId = :termId', { termId });
  if (where) qb.andWhere(where.sql, where.params);
  return qb.getCount();
}

async function termCounts(termId: string) {
  const ds = await getDataSource();
  const [attendanceRows, lmsRows, processResults, finalResults, completedRuns, alerts, waiting] =
    await Promise.all([
      countSourceRows(AttendanceSummary, termId),
      countSourceRows(LmsQuizAttempt, termId),
      countSourceRows(CourseResult, termId, {
        sql: 'r.resultStatus = :status',
        params: { status: CourseResultStatus.PROCESS_ONLY },
      }),
      countSourceRows(CourseResult, termId, {
        sql: 'r.resultStatus = :status',
        params: { status: CourseResultStatus.FINAL },
      }),
      ds.getRepository(EvaluationRun).countBy({ termId, status: EvaluationRunStatus.COMPLETED }),
      ds.getRepository(Alert).countBy({ termId }),
      ds.getRepository(Alert).countBy({
        termId,
        status: In([AlertStatus.OPEN, AlertStatus.REOPENED]),
      }),
    ]);
  return {
    attendanceRows,
    lmsRows,
    processResults,
    finalResults,
    completedRuns,
    alerts,
    waitingAlerts: waiting,
  };
}

export async function getSetupCounts(): Promise<SetupCounts> {
  const ds = await getDataSource();
  const advisors = (status: UserAccountStatus) =>
    ds.getRepository(User).countBy({ role: UserRole.ADVISOR, accountStatus: status });
  const [departments, activeAdvisors, pendingAdvisors, classes, withoutAdvisor, students, term] =
    await Promise.all([
      ds.getRepository(Department).count(),
      advisors(UserAccountStatus.ACTIVE),
      advisors(UserAccountStatus.PENDING_APPROVAL),
      ds.getRepository(AdministrativeClass).count(),
      ds.getRepository(AdministrativeClass).countBy({ advisorId: IsNull() }),
      ds.getRepository(Student).count(),
      ds.getRepository(Term).findOneBy({ isCurrent: true }),
    ]);
  const perTerm = term
    ? await termCounts(term.termId)
    : {
        attendanceRows: 0,
        lmsRows: 0,
        processResults: 0,
        finalResults: 0,
        completedRuns: 0,
        alerts: 0,
        waitingAlerts: 0,
      };
  return {
    departments,
    activeAdvisors,
    pendingAdvisors,
    classes,
    classesWithoutAdvisor: withoutAdvisor,
    students,
    currentTerm: term
      ? { termId: term.termId, termName: term.termName, closed: term.closedAt !== null }
      : null,
    ...perTerm,
  };
}

export async function getSetupSteps(): Promise<SetupStep[]> {
  return buildSetupSteps(await getSetupCounts());
}
