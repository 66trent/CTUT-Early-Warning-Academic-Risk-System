import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { Alert } from '@/db/entities/alert.entity';
import {
  AlertStatus,
  ConfidentialityLevel,
  InterventionType,
  OPEN_ALERT_STATUSES,
  Severity,
} from '@/db/enums';
import { firstPage } from '@/lib/list-params';
import { getAdminOverview } from '@/modules/admin/services/overview.service';
import {
  getAdvisorClasses,
  getAttentionStudents,
  getDueFollowUps,
  getRecentActivity,
} from '@/modules/alerts/services/advisor-dashboard.service';
import {
  changeAlertStatus,
  recordIntervention,
} from '@/modules/alerts/services/alert-lifecycle.service';
import { listAdminAlerts, listAdvisorAlerts } from '@/modules/alerts/services/alert-query.service';
import {
  getAlertSummary,
  getRunTrend,
  getSourceBreakdown,
} from '@/modules/alerts/services/dashboard.service';
import { listRunStudents } from '@/modules/rule-engine/services/evaluation-query.service';
import { cleanupDemo, DEMO, endOf, evaluate, setupDemo } from '../helpers/demo-setup';
import { useMemoryStorage } from '../helpers/import-helpers';

/**
 * Phase 8d — số liệu 2 trang tổng quan khớp danh sách cùng bộ lọc (bộ demo v2), phạm vi Cố vấn
 * học tập (CVHT A không thấy số liệu lớp CVHT B), DTO thuần.
 */
let ds: DataSource;
let runIds: string[] = [];

function expectPlain(value: unknown) {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  for (const item of Array.isArray(value) ? value : [value]) {
    expect(Object.getPrototypeOf(item)).toBe(Object.prototype);
  }
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await setupDemo(ds);
  runIds = [
    await evaluate(DEMO.hk1, endOf('2025-10-10')),
    await evaluate(DEMO.hk1, endOf('2025-10-16')),
  ];
});

afterAll(async () => {
  await cleanupDemo(ds);
  await closeDataSource();
});

describe('Tổng quan Admin — khớp danh sách cảnh báo', () => {
  it('số theo nhóm trạng thái và theo mức khớp danh sách lọc cùng điều kiện', async () => {
    const o = await getAdminOverview(DEMO.hk1, 'K.CNTT');
    expectPlain(o);
    const total = async (status: 'waiting' | 'following' | 'done') =>
      (await listAdminAlerts(DEMO.hk1, 'ALL', 'K.CNTT', firstPage({ size: 100 }), { status }))
        .total;
    // Dữ liệu thử chỉ ở lớp TSTK2411 nhưng khoa K.CNTT có thể có dữ liệu khác → so cùng phạm vi.
    expect(o.summary.waiting).toBe(await total('waiting'));
    expect(o.summary.following).toBe(await total('following'));
    expect(o.summary.done).toBe(await total('done'));
    const critical = await listAdminAlerts(DEMO.hk1, 'ALL', 'K.CNTT', firstPage({ size: 100 }), {
      severity: Severity.CRITICAL,
    });
    const activeCritical = critical.items.filter((a) => OPEN_ALERT_STATUSES.includes(a.status));
    expect(o.summary.activeBySeverity.find((s) => s.severity === Severity.CRITICAL)?.count).toBe(
      activeCritical.length,
    );
  });

  it('diễn biến: mỗi mốc 1 điểm, tăng dần theo mốc, số sinh viên khớp kết quả lần chạy', async () => {
    const trend = await getRunTrend({ termId: DEMO.hk1 });
    expectPlain(trend);
    expect(trend.map((p) => p.asOf)).toEqual([...trend.map((p) => p.asOf)].sort());
    expect(trend).toHaveLength(2);
    const last = trend.at(-1);
    expect(last?.runId).toBe(runIds[1]);
    const students = await listRunStudents(
      runIds[1] ?? '',
      { all: false },
      firstPage({ size: 100 }),
    );
    expect(last?.studentsWithSignals).toBe(students.total);
    // Chạy lại cùng ngày mốc → vẫn 1 điểm (lấy lần mới nhất).
    const rerun = await evaluate(DEMO.hk1, endOf('2025-10-16'));
    const again = await getRunTrend({ termId: DEMO.hk1 });
    expect(again).toHaveLength(2);
    expect(again.at(-1)?.runId).toBe(rerun);
  });

  it('nguồn dấu hiệu, độ mới dữ liệu, dải cần chú ý', async () => {
    const o = await getAdminOverview(DEMO.hk1, 'K.CNTT');
    expect(o.sources.map((s) => s.source)).toEqual(['ATTENDANCE', 'LMS', 'ACADEMIC', 'COMBINED']);
    expect(o.sources.some((s) => s.students > 0)).toBe(true);
    const att = o.freshness.sources.find((f) => f.source === 'ATTENDANCE');
    expect(att?.latest).not.toBeNull();
    expect(o.freshness.totalCourses).toBeGreaterThanOrEqual(3);
    expect(o.attention.criticalWaiting).toBe(o.summary.criticalWaiting);
  });

  it('học kỳ chưa có dữ liệu → toàn số 0, không lỗi', async () => {
    const o = await getAdminOverview('TSTKHONGCO', null);
    expect(o.summary).toMatchObject({ waiting: 0, following: 0, done: 0, studentsWithAlerts: 0 });
    expect(o.trend).toEqual([]);
    expect(o.lastRun).toBeNull();
    expect(o.freshness.totalCourses).toBe(0);
  });
});

describe('Tổng quan Cố vấn học tập — phạm vi lớp mình', () => {
  it('CVHT A thấy số liệu lớp mình, khớp danh sách; CVHT B (lớp không có sinh viên) toàn 0', async () => {
    const a = await getAlertSummary({ termId: DEMO.hk1, advisorId: DEMO.advisorA });
    const todo = await listAdvisorAlerts(DEMO.advisorA, DEMO.hk1, 'TODO');
    expect(a.waiting + a.following).toBe(todo.total);
    expect(a.studentsWithAlerts).toBeGreaterThan(0);
    expect(a.totalStudents).toBe(20);

    const b = await getAlertSummary({ termId: DEMO.hk1, advisorId: DEMO.advisorB });
    expect(b).toMatchObject({ waiting: 0, following: 0, done: 0, totalStudents: 0 });
    expect(await getAttentionStudents(DEMO.advisorB, DEMO.hk1)).toEqual([]);
    expect(
      (await getRunTrend({ termId: DEMO.hk1, advisorId: DEMO.advisorB })).every(
        (p) => p.studentsWithSignals === 0,
      ),
    ).toBe(true);
    expect(
      (await getSourceBreakdown({ termId: DEMO.hk1, advisorId: DEMO.advisorB })).every(
        (s) => s.students === 0,
      ),
    ).toBe(true);
  });

  it('lớp phụ trách, sinh viên cần chú ý (mức cao nhất trước)', async () => {
    const classes = await getAdvisorClasses(DEMO.advisorA, DEMO.hk1);
    expectPlain(classes);
    expect(classes[0]).toMatchObject({ classId: 'TSTK2411', students: 20 });
    const top = await getAttentionStudents(DEMO.advisorA, DEMO.hk1);
    expectPlain(top);
    expect(top.length).toBeLessThanOrEqual(5);
    expect(top[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('hẹn theo dõi đến hạn + hoạt động gần đây chỉ của chính CVHT', async () => {
    const alert = await ds.getRepository(Alert).findOneOrFail({
      where: { termId: DEMO.hk1, studentId: 'TSTK2411908' },
    });
    await changeAlertStatus(alert.alertId, AlertStatus.ACKNOWLEDGED, DEMO.advisorA, null);
    await recordIntervention(
      alert.alertId,
      {
        type: InterventionType.PHONE_CALL,
        content: 'Gọi điện nhắc nộp bài thực hành',
        outcome: null,
        status: 'FOLLOW_UP',
        nextFollowUpAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        confidentialityLevel: ConfidentialityLevel.NORMAL,
      },
      DEMO.advisorA,
    );
    const due = await getDueFollowUps(DEMO.advisorA, DEMO.hk1);
    expect(due.map((d) => d.studentId)).toContain('TSTK2411908');
    expect(await getDueFollowUps(DEMO.advisorB, DEMO.hk1)).toEqual([]);

    const activity = await getRecentActivity(DEMO.advisorA);
    expectPlain(activity);
    expect(activity.some((x) => x.kind === 'INTERVENTION' && x.studentId === 'TSTK2411908')).toBe(
      true,
    );
    expect(
      activity.some((x) => x.kind === 'STATUS' && x.toStatus === AlertStatus.ACKNOWLEDGED),
    ).toBe(true);
    expect(await getRecentActivity(DEMO.advisorB)).toEqual([]);
  });
});
