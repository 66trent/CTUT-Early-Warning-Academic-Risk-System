import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AuditLog } from '@/db/entities/audit-log.entity';
import { Severity, UserRole } from '@/db/enums';
import { firstPage } from '@/lib/list-params';
import { exportAlerts } from '@/modules/alerts/services/alert-export.service';
import { listAdvisorAlerts } from '@/modules/alerts/services/alert-query.service';
import { getClassMatrix, TERM_COLUMN } from '@/modules/alerts/services/class-matrix.service';
import {
  listInAppNotificationsPaged,
  markInAppNotificationRead,
} from '@/modules/alerts/services/notification.service';
import { getStudentInsights } from '@/modules/alerts/services/student-insights.service';
import { getAttendanceThreshold } from '@/modules/rule-engine/services/student-academic.service';
import { cleanupDemo, DEMO, endOf, evaluate, setupDemo } from '../helpers/demo-setup';
import { useMemoryStorage } from '../helpers/import-helpers';

/**
 * Phase 8e — màn hình Cố vấn học tập và sinh viên: danh sách có lọc + phân trang, xuất file (phạm
 * vi, chống chèn công thức, Audit Log), thông báo, ma trận, hồ sơ (bộ demo v2).
 */
let ds: DataSource;

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
  await evaluate(DEMO.hk1, endOf('2025-10-10'));
});

afterAll(async () => {
  await ds.query(`DELETE FROM audit_logs WHERE action = 'ALERT_EXPORT' AND target_id = $1`, [
    DEMO.hk1,
  ]);
  await cleanupDemo(ds);
  await closeDataSource();
});

describe('Danh sách cảnh báo CVHT — lọc, tìm, phân trang', () => {
  it('phân trang ở server, mức cao nhất trước, lý do = dấu hiệu nặng nhất', async () => {
    const all = await listAdvisorAlerts(DEMO.advisorA, DEMO.hk1, 'TODO');
    const page2 = await listAdvisorAlerts(
      DEMO.advisorA,
      DEMO.hk1,
      'TODO',
      {},
      firstPage({ size: 5, page: 2 }),
    );
    expect(page2.total).toBe(all.total);
    expect(page2.items).toHaveLength(Math.min(5, all.total - 5));
    expect(all.items[0]?.severity).toBe(Severity.CRITICAL);
    expect(all.items.every((a) => a.summary.length > 0 && !a.summary.includes('nguyên nhân'))).toBe(
      true,
    );
    expectPlain(all.items);
  });

  it('lọc theo từ khóa, mức, nguồn', async () => {
    const byName = await listAdvisorAlerts(DEMO.advisorA, DEMO.hk1, 'TODO', { q: 'TSTK2411908' });
    expect(byName.items.map((a) => a.studentId)).toEqual(['TSTK2411908']);
    const critical = await listAdvisorAlerts(DEMO.advisorA, DEMO.hk1, 'TODO', {
      severity: Severity.CRITICAL,
    });
    expect(critical.items.every((a) => a.severity === Severity.CRITICAL)).toBe(true);
    const lms = await listAdvisorAlerts(DEMO.advisorA, DEMO.hk1, 'TODO', { source: 'LMS' });
    expect(lms.items.map((a) => a.studentId)).toContain('TSTK2411908');
    expect(lms.total).toBeLessThanOrEqual(
      (await listAdvisorAlerts(DEMO.advisorA, DEMO.hk1, 'TODO')).total,
    );
  });
});

describe('Xuất danh sách cảnh báo', () => {
  it('CVHT A: file Excel đủ dòng, cột tiếng Việt, ghi Audit Log; CVHT B: 0 dòng', async () => {
    const total = (await listAdvisorAlerts(DEMO.advisorA, DEMO.hk1, 'TODO')).total;
    const file = await exportAlerts(
      { role: UserRole.ADVISOR, userId: DEMO.advisorA, view: 'TODO' },
      DEMO.hk1,
      {},
      'xlsx',
    );
    expect(file.rows).toBe(total);
    expect(file.fileName).toMatch(/^canh-bao_TSTHK1_25_\d{8}\.xlsx$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.body as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const sheet = wb.worksheets[0];
    expect(sheet?.rowCount).toBe(total + 1);
    expect(sheet?.getRow(1).getCell(2).value).toBe('MSSV');
    const headers = (sheet?.getRow(1).values as unknown[]).filter(Boolean);
    expect(headers).not.toContain('Cố vấn học tập');

    const log = await ds.getRepository(AuditLog).findOne({
      where: { action: 'ALERT_EXPORT', actorId: DEMO.advisorA },
      order: { createdAt: 'DESC' },
    });
    expect(log?.detail).toMatchObject({ format: 'xlsx', rows: total });

    const none = await exportAlerts(
      { role: UserRole.ADVISOR, userId: DEMO.advisorB, view: 'ALL' },
      DEMO.hk1,
      {},
      'csv',
    );
    expect(none.rows).toBe(0);
    expect((none.body as string).split('\r\n')).toHaveLength(1);
  });

  it('Admin xuất CSV có cột Cố vấn học tập, lọc khoa', async () => {
    const file = await exportAlerts(
      { role: UserRole.ADMIN, userId: 'ADMIN', departmentId: 'K.CNTT', noAdvisor: false },
      DEMO.hk1,
      { severity: Severity.CRITICAL },
      'csv',
    );
    const [header] = (file.body as string).slice(1).split('\r\n');
    expect(header?.endsWith('Cố vấn học tập')).toBe(true);
    expect(file.rows).toBeGreaterThan(0);
  });
});

describe('Thông báo, ma trận, hồ sơ', () => {
  it('thông báo: phân trang, lọc chưa đọc, chỉ người nhận đánh dấu được', async () => {
    const all = await listInAppNotificationsPaged(DEMO.advisorA, false);
    expect(all.total).toBeGreaterThan(0);
    expectPlain(all.items);
    const first = all.items[0];
    if (!first) throw new Error('không có thông báo');
    await markInAppNotificationRead(DEMO.advisorB, first.notificationId);
    expect((await listInAppNotificationsPaged(DEMO.advisorA, true)).unread).toBe(all.unread);
    await markInAppNotificationRead(DEMO.advisorA, first.notificationId);
    const after = await listInAppNotificationsPaged(DEMO.advisorA, true);
    expect(after.unread).toBe(all.unread - 1);
    expect(after.items.some((n) => n.notificationId === first.notificationId)).toBe(false);
  });

  it('ma trận sinh viên × học phần: đúng lớp, ô có mức; CVHT khác lớp → null', async () => {
    const m = await getClassMatrix(DEMO.advisorA, 'TSTK2411', DEMO.hk1);
    expect(m?.rows).toHaveLength(20);
    expect(m?.courses.length).toBe(3);
    const s908 = m?.rows.find((r) => r.studentId === 'TSTK2411908');
    expect(Object.keys(s908?.cells ?? {}).length).toBeGreaterThan(0);
    expect(s908?.alertId).not.toBeNull();
    expect(m?.rows[0]?.worst).toBe(Severity.CRITICAL);
    expect(
      Object.keys(m?.rows[0]?.cells ?? {}).every((k) => k === TERM_COLUMN || k.startsWith('TST')),
    ).toBe(true);
    expect(await getClassMatrix(DEMO.advisorB, 'TSTK2411', DEMO.hk1)).toBeNull();
  });

  it('hồ sơ: ngưỡng vắng đọc từ luật đang áp dụng, diễn biến vắng, ĐTB, dòng thời gian', async () => {
    const threshold = await getAttendanceThreshold();
    expect(threshold?.percent).toBe(20);
    const insights = await getStudentInsights('TSTK2411908', DEMO.hk1);
    expectPlain(insights);
    expect(insights.threshold).toEqual(threshold);
    expect(insights.attendance.length).toBeGreaterThan(0);
    expect(insights.sources.find((s) => s.source === 'LMS')?.severity).not.toBeNull();
    expect(insights.timeline.some((e) => e.kind === 'ALERT_DETECTED')).toBe(true);
    expect(insights.timeline.some((e) => e.kind === 'ATTENDANCE')).toBe(true);
    expect(insights.gpas).toHaveLength(1);
    expect(insights.gpas[0]?.gpa).not.toBeNull();
  });
});
