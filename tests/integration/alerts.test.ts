import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AlertStateHistory } from '@/db/entities/alert-state-history.entity';
import { Alert } from '@/db/entities/alert.entity';
import { EvaluationRun } from '@/db/entities/evaluation-run.entity';
import { Notification } from '@/db/entities/notification.entity';
import { RuleTrigger } from '@/db/entities/rule-trigger.entity';
import {
  AlertStatus,
  ConfidentialityLevel,
  InterventionType,
  NotificationChannel,
  UserAccountStatus,
  UserRole,
} from '@/db/enums';
import { assertScope, type SessionUser } from '@/lib/authz';
import { changeClassAdvisor } from '@/modules/admin/services/class.service';
import {
  acknowledgeLowAlerts,
  changeAlertStatus,
  recordIntervention,
} from '@/modules/alerts/services/alert-lifecycle.service';
import {
  getAlertDetail,
  listAdminAlerts,
  listAdvisorAlerts,
} from '@/modules/alerts/services/alert-query.service';
import { getStudentOverview } from '@/modules/alerts/services/student-profile.service';
import { rollbackImportBatch } from '@/modules/data-import/services/import-batch.service';
import {
  processEvaluationRun,
  requestAutoEvaluation,
} from '@/modules/rule-engine/services/evaluation-run.service';
import { cleanupDemo, DEMO, endOf, evaluate, loadCsv, setupDemo } from '../helpers/demo-setup';
import {
  demoStudentsCsv,
  IMPORT_ACTOR,
  noEnqueue,
  useMemoryStorage,
} from '../helpers/import-helpers';

/** Bảng "Cảnh báo mong đợi — sau chạy 1" trong docs/demo-data/KET_QUA_MONG_DOI.md (bộ v2). */
let ds: DataSource;
const sent: string[] = [];

const user = (userId: string, role: UserRole): SessionUser => ({
  userId,
  authUserId: `auth-${userId}`,
  role,
  fullName: userId,
  email: `${userId.toLowerCase()}@x.vn`,
  accountStatus: UserAccountStatus.ACTIVE,
});

async function alertOf(studentId: string, termId: string = DEMO.hk1): Promise<Alert> {
  return ds.getRepository(Alert).findOneOrFail({
    where: { studentId, termId },
    order: { firstDetectedAt: 'DESC' },
  });
}

async function signalsOf(alert: Alert): Promise<string[]> {
  const ts = await ds
    .getRepository(RuleTrigger)
    .findBy({ alertId: alert.alertId, evaluationRunId: alert.lastEvaluationRunId });
  return ts.map((t) => t.ruleCode).sort();
}

const intervention = {
  type: InterventionType.PHONE_CALL,
  content: 'Đã gọi điện trao đổi về việc vắng học.',
  outcome: null,
  status: 'DONE' as const,
  nextFollowUpAt: null,
  confidentialityLevel: ConfidentialityLevel.NORMAL,
};

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await setupDemo(ds);
  await evaluate(DEMO.hk1, endOf('2025-10-10'), sent);
});

afterAll(async () => {
  await cleanupDemo(ds);
  await closeDataSource();
});

describe('Nghiệm thu: cảnh báo mong đợi — 1 cảnh báo / sinh viên / học kỳ', () => {
  const EXPECTED: [string, string, string[]][] = [
    ['TSTK2411902', 'MEDIUM', ['ATT-01']],
    ['TSTK2411903', 'CRITICAL', ['ATT-01', 'ATT-02']],
    ['TSTK2411904', 'HIGH', ['ATT-01']],
    ['TSTK2411905', 'HIGH', ['LMS-01']],
    ['TSTK2411906', 'MEDIUM', ['LMS-02']],
    ['TSTK2411908', 'HIGH', ['LMS-03']],
    ['TSTK2411909', 'LOW', ['LMS-04']],
    ['TSTK2411910', 'CRITICAL', ['ATT-01', 'COMB-01', 'LMS-03']],
    ['TSTK2411911', 'MEDIUM', ['ATT-01', 'LMS-04']],
    ['TSTK2411913', 'CRITICAL', ['ATT-01', 'ATT-02']],
  ];

  it('đúng và đủ 10 cảnh báo OPEN, đúng mức, đúng dấu hiệu, đúng Cố vấn học tập; luôn chỉ tham khảo', async () => {
    const alerts = await ds.getRepository(Alert).find({ where: { termId: DEMO.hk1 } });
    expect(alerts).toHaveLength(10);
    for (const [studentId, severity, rules] of EXPECTED) {
      const alert = await alertOf(studentId);
      expect(alert, studentId).toMatchObject({
        status: AlertStatus.OPEN,
        severity,
        assignedAdvisorId: DEMO.advisorA,
        isReferenceOnly: true,
      });
      expect(await signalsOf(alert), studentId).toEqual(rules);
    }
  });

  it('thông báo khi tạo: 10 trong ứng dụng + 9 email (mức Thấp không gửi email)', async () => {
    const notes = await ds
      .getRepository(Notification)
      .createQueryBuilder('n')
      .innerJoin(Alert, 'a', 'a.alertId = n.alertId')
      .where(`a.studentId LIKE 'TST%'`)
      .getMany();
    expect(notes.filter((n) => n.channel === NotificationChannel.IN_APP)).toHaveLength(10);
    expect(notes.filter((n) => n.channel === NotificationChannel.EMAIL)).toHaveLength(9);
    expect(sent).toHaveLength(9);
  });

  it('chạy lại cùng mốc → không thêm cảnh báo, không thông báo mới, chỉ thêm bằng chứng', async () => {
    const before = await ds.getRepository(Notification).count();
    const again: string[] = [];
    const runId = await evaluate(DEMO.hk1, endOf('2025-10-10'), again);
    expect(await ds.getRepository(EvaluationRun).findOneByOrFail({ id: runId })).toMatchObject({
      alertsCreated: 0,
      alertsUpdated: 10,
    });
    expect(await ds.getRepository(Alert).countBy({ termId: DEMO.hk1 })).toBe(10);
    expect(await ds.getRepository(Notification).count()).toBe(before);
    expect(again).toEqual([]);
  });
});

describe('Phân quyền (DoD): Admin chỉ đọc, CVHT khác và sinh viên khác bị chặn', () => {
  it('Admin đọc được nhưng không xử lý được; CVHT lớp khác không đọc/xử lý được', async () => {
    const alert = await alertOf('TSTK2411903');
    const ctx = { studentId: alert.studentId, resourceType: 'Alert' as const };
    await expect(assertScope(user('ADMIN', UserRole.ADMIN), ctx)).resolves.toBeUndefined();
    await expect(
      assertScope(user('ADMIN', UserRole.ADMIN), { ...ctx, action: 'PROCESS' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      assertScope(user(DEMO.advisorB, UserRole.ADVISOR), { ...ctx, action: 'PROCESS' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(assertScope(user(DEMO.advisorB, UserRole.ADVISOR), ctx)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      assertScope(user(DEMO.advisorA, UserRole.ADVISOR), { ...ctx, action: 'PROCESS' }),
    ).resolves.toBeUndefined();
  });

  it('sinh viên chỉ đọc của chính mình', async () => {
    const ctx = { studentId: 'TSTK2411903', resourceType: 'Alert' as const };
    await expect(assertScope(user('TSTK2411903', UserRole.STUDENT), ctx)).resolves.toBeUndefined();
    await expect(assertScope(user('TSTK2411901', UserRole.STUDENT), ctx)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('danh sách CVHT suy ra qua lớp: A thấy 10, B (lớp không có sinh viên) không thấy gì; sắp mức giảm dần', async () => {
    const a = await listAdvisorAlerts(DEMO.advisorA, DEMO.hk1, 'TODO');
    expect(a).toHaveLength(10);
    expect(a[0]?.severity).toBe('CRITICAL');
    expect(a.at(-1)?.severity).toBe('LOW');
    expect(Object.getPrototypeOf(a[0])).toBe(Object.prototype);
    expect(await listAdvisorAlerts(DEMO.advisorB, DEMO.hk1, 'TODO')).toEqual([]);
    expect(a.find((x) => x.studentId === 'TSTK2411910')?.summary).toBe(
      '3 nguyên nhân: điểm danh, bài LMS, kết hợp nhiều nguồn',
    );
  });
});

describe('Máy trạng thái + can thiệp', () => {
  it('không bỏ qua bước: OPEN → RESOLVED bị chặn; bỏ qua (DISMISSED) bắt buộc lý do', async () => {
    const alert = await alertOf('TSTK2411903');
    await expect(
      changeAlertStatus(alert.alertId, AlertStatus.RESOLVED, DEMO.advisorA, null),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await expect(
      changeAlertStatus(alert.alertId, AlertStatus.DISMISSED, DEMO.advisorA, '  '),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('xác nhận → ghi can thiệp (tự sang Đang xử lý) → Đã xử lý; mỗi bước có lịch sử', async () => {
    const alert = await alertOf('TSTK2411903');
    await changeAlertStatus(alert.alertId, AlertStatus.ACKNOWLEDGED, DEMO.advisorA, null);
    await recordIntervention(alert.alertId, intervention, DEMO.advisorA);
    expect((await alertOf('TSTK2411903')).status).toBe(AlertStatus.IN_PROGRESS);
    await changeAlertStatus(alert.alertId, AlertStatus.RESOLVED, DEMO.advisorA, null);
    const history = await ds
      .getRepository(AlertStateHistory)
      .find({ where: { alertId: alert.alertId }, order: { changedAt: 'ASC' } });
    expect(history.map((h) => h.toStatus)).toEqual([
      AlertStatus.OPEN,
      AlertStatus.ACKNOWLEDGED,
      AlertStatus.IN_PROGRESS,
      AlertStatus.RESOLVED,
    ]);
    await expect(
      recordIntervention(alert.alertId, intervention, DEMO.advisorA),
    ).rejects.toMatchObject({ code: 'ALERT_CLOSED' });
  });

  it('Đã xử lý mà chưa có can thiệp → bị chặn', async () => {
    const alert = await alertOf('TSTK2411902');
    await changeAlertStatus(alert.alertId, AlertStatus.ACKNOWLEDGED, DEMO.advisorA, null);
    await changeAlertStatus(alert.alertId, AlertStatus.IN_PROGRESS, DEMO.advisorA, null);
    await expect(
      changeAlertStatus(alert.alertId, AlertStatus.RESOLVED, DEMO.advisorA, null),
    ).rejects.toMatchObject({ code: 'INTERVENTION_REQUIRED' });
  });

  it('nội dung can thiệp SENSITIVE ẩn với Admin, hiện với Cố vấn học tập phụ trách', async () => {
    const alert = await alertOf('TSTK2411902');
    await recordIntervention(
      alert.alertId,
      {
        ...intervention,
        content: 'Sinh viên chia sẻ vấn đề sức khỏe.',
        confidentialityLevel: ConfidentialityLevel.SENSITIVE,
      },
      DEMO.advisorA,
    );
    const forAdmin = await getAlertDetail(alert.alertId, { canProcess: false });
    const forAdvisor = await getAlertDetail(alert.alertId, { canProcess: true });
    expect(forAdmin?.interventions[0]).toMatchObject({ sensitive: true, content: null });
    expect(forAdmin?.allowedTransitions).toEqual([]);
    expect(forAdvisor?.interventions[0]?.content).toContain('sức khỏe');
    expect(forAdvisor?.groups.map((g) => g.label)).toEqual(['Điểm danh']);
  });

  it('sinh viên chỉ thấy cảnh báo SAU KHI Cố vấn học tập xác nhận', async () => {
    expect((await getStudentOverview('TSTK2411905', DEMO.hk1))?.focus).toEqual([]);
    expect((await getStudentOverview('TSTK2411902', DEMO.hk1))?.level).toBe('NEEDS_ATTENTION');
    expect((await getStudentOverview('TSTK2411902', DEMO.hk1))?.advisor?.fullName).toBe(
      `Cố vấn ${DEMO.advisorA}`,
    );
  });

  it('đánh dấu đã xem tất cả cảnh báo mức Thấp', async () => {
    expect(await acknowledgeLowAlerts(DEMO.advisorA, DEMO.hk1)).toBe(1);
    expect((await alertOf('TSTK2411909')).status).toBe(AlertStatus.ACKNOWLEDGED);
  });
});

describe('Mở lại theo dấu hiệu mới/nặng hơn, tăng mức', () => {
  it('đã xử lý + chạy lại cùng dấu hiệu → vẫn Đã xử lý, không thông báo', async () => {
    await evaluate(DEMO.hk1, endOf('2025-10-10'));
    expect((await alertOf('TSTK2411903')).status).toBe(AlertStatus.RESOLVED);
  });

  it('dữ liệu mới 16/10: KTPM2411904 tăng HIGH → CRITICAL (có thông báo); KTPM2411903 vắng thêm môn khác → mở lại', async () => {
    await loadCsv(
      ds,
      'tst-p5-diem-danh-1016.csv',
      [
        'mssv,ma_lop_hoc_phan,ten_hoc_phan,ngay_chot,tong_so_tiet,vang_co_phep,vang_khong_phep',
        'TSTK2411904,TST010239401,Ngôn ngữ lập trình 1,2025-10-16,45,0,11',
        'TSTK2411903,TST010241001,Cơ sở dữ liệu,2025-10-16,45,2,4',
      ].join('\n'),
      'ATTENDANCE_SUMMARY',
      DEMO.hk1,
    );
    const emails: string[] = [];
    await evaluate(DEMO.hk1, endOf('2025-10-16'), emails);

    const a904 = await alertOf('TSTK2411904');
    expect(a904).toMatchObject({ severity: 'CRITICAL', status: AlertStatus.OPEN });
    const a903 = await alertOf('TSTK2411903');
    expect(a903.status).toBe(AlertStatus.REOPENED);
    expect(await signalsOf(a903)).toEqual(['ATT-01', 'ATT-01', 'ATT-02']);
    const events = await ds.getRepository(Notification).findBy({
      channel: NotificationChannel.EMAIL,
      alertId: a904.alertId,
      event: 'SEVERITY_INCREASED',
    });
    expect(events).toHaveLength(1);
    expect(
      await ds.getRepository(Notification).countBy({ alertId: a903.alertId, event: 'REOPENED' }),
    ).toBe(2);
    expect(emails.length).toBeGreaterThanOrEqual(2);
  });

  it('lần chạy mốc cũ hơn (demo chạy lại 10/10) → chỉ thêm bằng chứng, không hạ mức', async () => {
    await evaluate(DEMO.hk1, endOf('2025-10-10'));
    expect((await alertOf('TSTK2411904')).severity).toBe('CRITICAL');
    expect((await alertOf('TSTK2411903')).status).toBe(AlertStatus.REOPENED);
  });
});

describe('Chuyển người phụ trách và hoàn tác lô', () => {
  it('Admin đổi CVHT lớp TSTK2411 → cảnh báo đang mở chuyển sang B; A mất quyền xem ngay', async () => {
    await changeClassAdvisor({ classId: 'TSTK2411', advisorId: DEMO.advisorB }, IMPORT_ACTOR);
    const moved = await ds
      .getRepository(Alert)
      .findBy({ termId: DEMO.hk1, status: AlertStatus.IN_PROGRESS });
    expect(moved.every((a) => a.assignedAdvisorId === DEMO.advisorB)).toBe(true);
    expect(await listAdvisorAlerts(DEMO.advisorA, DEMO.hk1, 'ALL')).toEqual([]);
    expect((await listAdvisorAlerts(DEMO.advisorB, DEMO.hk1, 'TODO')).length).toBeGreaterThan(1);
    await expect(
      assertScope(user(DEMO.advisorA, UserRole.ADVISOR), {
        studentId: 'TSTK2411903',
        resourceType: 'Alert',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await changeClassAdvisor({ classId: 'TSTK2411', advisorId: null }, IMPORT_ACTOR);
    expect((await listAdminAlerts(DEMO.hk1, 'NO_ADVISOR')).total).toBeGreaterThan(0);
    await changeClassAdvisor({ classId: 'TSTK2411', advisorId: DEMO.advisorA }, IMPORT_ACTOR);
  });

  it('sinh viên đổi lớp qua nhập danh sách → cảnh báo đang mở chuyển sang CVHT lớp mới', async () => {
    const moved = demoStudentsCsv().replace(/^(TSTK2411905,[^\r\n]*,)TSTK2411,/m, '$1TSTH2411,');
    expect(moved).not.toBe(demoStudentsCsv());
    await loadCsv(ds, 'tst-p5-doi-lop.csv', moved, 'STUDENT', null);
    expect((await alertOf('TSTK2411905')).assignedAdvisorId).toBe(DEMO.advisorB);
    expect(
      (await listAdvisorAlerts(DEMO.advisorB, DEMO.hk1, 'TODO')).map((a) => a.studentId),
    ).toContain('TSTK2411905');
  });

  it('hoàn tác lô làm phát sinh cảnh báo → lần chạy lại chuyển cảnh báo "không còn hiệu lực"', async () => {
    const batch = await loadCsv(
      ds,
      'tst-p5-sai.csv',
      [
        'mssv,ma_lop_hoc_phan,ten_hoc_phan,ngay_chot,tong_so_tiet,vang_co_phep,vang_khong_phep',
        'TSTK2411920,TST010299901,Thực tập chuyên ngành,2025-10-12,15,0,5',
      ].join('\n'),
      'ATTENDANCE_SUMMARY',
      DEMO.hk1,
    );
    await evaluate(DEMO.hk1, endOf('2025-10-16'));
    expect((await alertOf('TSTK2411920')).status).toBe(AlertStatus.OPEN);
    let rollbackRun: string | null = null;
    await rollbackImportBatch(batch.id, IMPORT_ACTOR, async (b) => {
      rollbackRun = await requestAutoEvaluation(b, noEnqueue);
    });
    await processEvaluationRun(rollbackRun ?? '', noEnqueue);
    const alert = await alertOf('TSTK2411920');
    expect(alert).toMatchObject({ status: AlertStatus.INVALIDATED });
    expect(alert.closedReason).toContain('hoàn tác');
  });
});
