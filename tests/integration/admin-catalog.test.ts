import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QueryFailedError, type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Term } from '@/db/entities/term.entity';
import { User } from '@/db/entities/user.entity';
import { UserAccountStatus, UserRole } from '@/db/enums';
import { getEnv } from '@/lib/env';
import {
  changeAccountStatus,
  changeRole,
  changeStaffCode,
  listAccounts,
} from '@/modules/admin/services/account.service';
import {
  changeClassAdvisor,
  createClass,
  listAssignableAdvisors,
  listClasses,
  listDepartments,
} from '@/modules/admin/services/class.service';
import { createTerm, listTerms, setCurrentTerm } from '@/modules/admin/services/term.service';
import {
  processEvaluationRun,
  requestTermClosing,
} from '@/modules/rule-engine/services/evaluation-run.service';
import { cleanupIdentityFixtures, createIdentityFixtures, FX } from '../helpers/identity-fixtures';

/** Học kỳ thử dùng năm 2091–2093 để không đụng dữ liệu thật/demo. */
const TEST_TERM_FILTER = `term_id LIKE 'HK%\\_209%'`;
const ACTOR = 'ADMIN';
let ds: DataSource;
let originalCurrentTermId: string | null = null;

async function cleanupTerms() {
  await ds.query(
    `DELETE FROM audit_logs WHERE target_type = 'Term' AND target_id LIKE 'HK%\\_209%'`,
  );
  await ds.query(`DELETE FROM evaluation_runs WHERE ${TEST_TERM_FILTER}`);
  await ds.query(`DELETE FROM terms WHERE ${TEST_TERM_FILTER}`);
}

/** DTO trả cho Client Component phải là object thuần, không có prototype entity (docs/rules/01). */
function expectPlain(value: unknown) {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  for (const item of Array.isArray(value) ? value : [value]) {
    expect(Object.getPrototypeOf(item)).toBe(Object.prototype);
  }
}

beforeAll(async () => {
  ds = await getDataSource();
  const current = await ds.getRepository(Term).findOneBy({ isCurrent: true });
  originalCurrentTermId = current?.termId ?? null;
  await cleanupTerms();
  await createIdentityFixtures(ds, getEnv().STAFF_EMAIL_DOMAIN);
});

afterAll(async () => {
  await cleanupTerms();
  if (originalCurrentTermId) {
    await ds.getRepository(Term).update({ isCurrent: true }, { isCurrent: false });
    await ds.getRepository(Term).update({ termId: originalCurrentTermId }, { isCurrent: true });
  }
  await cleanupIdentityFixtures(ds);
  await closeDataSource();
});

describe('Học kỳ — tối đa 1 học kỳ hiện tại', () => {
  const term = (semester: number, startYear: number, setAsCurrent = false) => ({
    semester,
    startYear,
    startDate: `${startYear}-08-17`,
    endDate: `${startYear}-12-27`,
    setAsCurrent,
  });

  it('DB chặn 2 học kỳ hiện tại bằng partial unique index (lỗi 23505)', async () => {
    await createTerm(term(1, 2091), ACTOR);
    await createTerm(term(2, 2091), ACTOR);
    await ds.query(`UPDATE terms SET is_current = false WHERE is_current = true`);
    await ds.query(`UPDATE terms SET is_current = true WHERE term_id = 'HK1_2091'`);
    const error: unknown = await ds
      .query(`UPDATE terms SET is_current = true WHERE term_id = 'HK2_2091'`)
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(error).toBeInstanceOf(QueryFailedError);
    expect((error as QueryFailedError & { driverError: { code: string } }).driverError.code).toBe(
      '23505',
    );
  });

  it('đổi học kỳ hiện tại trong transaction → luôn đúng 1 học kỳ hiện tại', async () => {
    await setCurrentTerm('HK2_2091', ACTOR);
    await setCurrentTerm('HK1_2091', ACTOR);
    const current = await ds.getRepository(Term).findBy({ isCurrent: true });
    expect(current.map((t) => t.termId)).toEqual(['HK1_2091']);
  });

  it('tạo học kỳ kèm đặt hiện tại; trùng mã bị từ chối', async () => {
    const dto = await createTerm(term(1, 2092, true), ACTOR);
    expect(dto).toMatchObject({
      termId: 'HK1_2092',
      termName: 'Học kỳ 1, 2092–2093',
      isCurrent: true,
    });
    expect(dto.startDate).toBe('2092-08-17');
    await expect(createTerm(term(1, 2092), ACTOR)).rejects.toMatchObject({ code: 'TERM_EXISTS' });
  });

  it('chốt học kỳ = lần chạy đánh giá cuối rồi mới chốt; không chốt lại được, không đặt làm hiện tại được', async () => {
    await createTerm(term(1, 2093), ACTOR);
    const noEnqueue = () => Promise.resolve();
    const runId = await requestTermClosing(
      { termId: 'HK1_2093', asOf: new Date(), actorId: ACTOR },
      noEnqueue,
    );
    expect(
      (await ds.getRepository(Term).findOneByOrFail({ termId: 'HK1_2093' })).closedAt,
    ).toBeNull();
    await processEvaluationRun(runId, noEnqueue);
    expect(
      (await ds.getRepository(Term).findOneByOrFail({ termId: 'HK1_2093' })).closedAt,
    ).not.toBeNull();
    await expect(
      requestTermClosing({ termId: 'HK1_2093', asOf: new Date(), actorId: ACTOR }, noEnqueue),
    ).rejects.toMatchObject({ code: 'TERM_CLOSED' });
    await expect(setCurrentTerm('HK1_2093', ACTOR)).rejects.toMatchObject({ code: 'TERM_CLOSED' });
  });

  it('mọi thao tác học kỳ ghi Audit Log', async () => {
    const rows = await ds.query<{ action: string }[]>(
      `SELECT DISTINCT action FROM audit_logs WHERE target_type = 'Term' AND target_id LIKE 'HK%\\_209%'`,
    );
    expect(rows.map((r) => r.action).sort()).toEqual([
      'TERM_CLOSED',
      'TERM_CREATED',
      'TERM_SET_CURRENT',
    ]);
  });

  it('danh sách học kỳ là DTO thuần', async () => {
    expectPlain(await listTerms());
  });
});

describe('Lớp sinh hoạt — sĩ số và gán Cố vấn học tập', () => {
  it('sĩ số đếm bằng COUNT … GROUP BY, đúng số sinh viên của lớp', async () => {
    const classes = await listClasses();
    expect(classes.find((c) => c.classId === FX.classA)).toMatchObject({
      studentCount: 1,
      advisorId: FX.advisorA,
    });
    expectPlain(classes);
    expectPlain(await listDepartments());
    expectPlain(await listAssignableAdvisors());
  });

  it('chỉ gán được Cố vấn học tập đang hoạt động', async () => {
    await expect(
      createClass(
        {
          classId: 'TSTCLS_X',
          className: 'Lớp X',
          departmentId: FX.departmentId,
          cohortYear: '2024',
          advisorId: FX.advisorPending,
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'ADVISOR_NOT_ASSIGNABLE' });
  });

  it('đổi CVHT của lớp ghi Audit Log kèm người cũ và người mới', async () => {
    await changeClassAdvisor({ classId: FX.classB, advisorId: FX.advisorA }, ACTOR);
    const [row] = await ds.query<{ detail: { fromAdvisorId: string; toAdvisorId: string } }[]>(
      `SELECT detail FROM audit_logs WHERE action = 'CLASS_ADVISOR_CHANGED' AND target_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [FX.classB],
    );
    expect(row?.detail).toEqual({ fromAdvisorId: FX.advisorB, toAdvisorId: FX.advisorA });
    await changeClassAdvisor({ classId: FX.classB, advisorId: FX.advisorB }, ACTOR);
  });
});

describe('Tài khoản — duyệt, khóa, đổi vai trò', () => {
  it('danh sách tài khoản: chờ duyệt lên đầu, DTO thuần', async () => {
    const page = await listAccounts({ role: 'STAFF', q: 'TSTGV', status: undefined });
    expect(page.items[0]?.accountStatus).toBe(UserAccountStatus.PENDING_APPROVAL);
    expectPlain(page.items);
  });

  it('không được tự thay đổi tài khoản của chính mình', async () => {
    await expect(changeRole(FX.advisorA, UserRole.ADMIN, FX.advisorA)).rejects.toMatchObject({
      code: 'SELF_CHANGE_FORBIDDEN',
    });
    await expect(changeAccountStatus(FX.advisorA, 'SUSPEND', FX.advisorA)).rejects.toMatchObject({
      code: 'SELF_CHANGE_FORBIDDEN',
    });
  });

  it('CVHT đang phụ trách lớp: không khóa, không đổi vai trò được', async () => {
    await expect(changeAccountStatus(FX.advisorA, 'SUSPEND', ACTOR)).rejects.toMatchObject({
      code: 'ADVISOR_HAS_CLASSES',
    });
    await expect(changeRole(FX.advisorA, UserRole.ADMIN, ACTOR)).rejects.toMatchObject({
      code: 'ADVISOR_HAS_CLASSES',
    });
  });

  it('chỉ chuyển trạng thái hợp lệ (không "duyệt" tài khoản đang hoạt động)', async () => {
    await expect(changeAccountStatus(FX.advisorA, 'APPROVE', ACTOR)).rejects.toMatchObject({
      code: 'INVALID_STATUS',
    });
  });

  it('sửa mã cán bộ khi chờ duyệt, rồi duyệt → ACTIVE và có Audit Log', async () => {
    await changeStaffCode(FX.advisorPending, 'TSTGV_P2', ACTOR);
    await changeAccountStatus('TSTGV_P2', 'APPROVE', ACTOR);
    const user = await ds.getRepository(User).findOneByOrFail({ userId: 'TSTGV_P2' });
    expect(user.accountStatus).toBe(UserAccountStatus.ACTIVE);
    const [row] = await ds.query<{ n: string }[]>(
      `SELECT count(*) AS n FROM audit_logs WHERE action = 'ACCOUNT_APPROVED' AND target_id = 'TSTGV_P2'`,
    );
    expect(Number(row?.n)).toBe(1);
  });

  it('đổi vai trò ADVISOR → ADMIN khi không phụ trách lớp', async () => {
    await changeRole('TSTGV_P2', UserRole.ADMIN, ACTOR);
    expect((await ds.getRepository(User).findOneByOrFail({ userId: 'TSTGV_P2' })).role).toBe(
      UserRole.ADMIN,
    );
    expect(await ds.getRepository(AdministrativeClass).existsBy({ advisorId: 'TSTGV_P2' })).toBe(
      false,
    );
  });
});
