import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { MAJORS } from '@/db/seeds/departments';
import { firstPage } from '@/lib/list-params';
import { getAdminOverview } from '@/modules/admin/services/overview.service';
import {
  createClass,
  listMajors,
  searchClasses,
  updateClass,
} from '@/modules/admin/services/class.service';
import { searchStudents } from '@/modules/admin/services/student-search.service';
import { listAdminAlerts } from '@/modules/alerts/services/alert-query.service';
import { cleanupDemo, DEMO, endOf, evaluate, setupDemo } from '../helpers/demo-setup';
import { useMemoryStorage } from '../helpers/import-helpers';

/**
 * Phase 9a — danh mục Ngành (docs/rules/09): lớp chọn ngành cùng khoa; lọc theo ngành gom lớp
 * nhiều khóa; số liệu Admin theo ngành khớp danh sách.
 */
let ds: DataSource;
const ACTOR = 'ADMIN';
const NEW_CLASSES = ['TSTHT2411', 'TSTHT2511', 'TSTCK2411'];

function expectPlain(value: unknown) {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  for (const item of Array.isArray(value) ? value : [value]) {
    expect(Object.getPrototypeOf(item)).toBe(Object.prototype);
  }
}

async function cleanupClasses() {
  await ds.query(`DELETE FROM administrative_classes WHERE class_id = ANY($1)`, [NEW_CLASSES]);
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await cleanupClasses();
  await setupDemo(ds);
  // Lớp thử của bộ demo (vai KTPM2411) thuộc ngành KTPM.
  await ds.getRepository(AdministrativeClass).update({ classId: 'TSTK2411' }, { majorId: 'KTPM' });
  await evaluate(DEMO.hk1, endOf('2025-10-10'));
});

afterAll(async () => {
  await cleanupClasses();
  await cleanupDemo(ds);
  await closeDataSource();
});

describe('Danh mục ngành', () => {
  it('seed đủ 5 ngành Khoa CNTT', async () => {
    const majors = await listMajors();
    for (const m of MAJORS) expect(majors).toContainEqual(m);
    expect(majors.filter((m) => m.departmentId === 'K.CNTT')).toHaveLength(5);
    expectPlain(majors);
  });

  it('lớp khóa 2024 và 2025 cùng ngành HTTT được gom khi lọc theo ngành', async () => {
    const base = { departmentId: 'K.CNTT', majorId: 'HTTT', advisorId: null };
    await createClass(
      { ...base, classId: 'TSTHT2411', className: 'HTTT K2024 thử', cohortYear: '2024' },
      ACTOR,
    );
    await createClass(
      { ...base, classId: 'TSTHT2511', className: 'HTTT K2025 thử', cohortYear: '2025' },
      ACTOR,
    );
    const page = await searchClasses({ q: 'TSTHT', major: 'HTTT', noAdvisor: false });
    expect(page.items.map((c) => c.classId).sort()).toEqual(['TSTHT2411', 'TSTHT2511']);
    expect(page.items[0]).toMatchObject({ majorId: 'HTTT', majorName: 'Hệ thống thông tin' });
    expectPlain(page.items);
    const other = await searchClasses({ q: 'TSTHT', major: 'KHMT', noAdvisor: false });
    expect(other.total).toBe(0);
  });

  it('ngành phải thuộc khoa của lớp và có trong danh mục', async () => {
    await expect(
      createClass(
        {
          classId: 'TSTCK2411',
          className: 'Cơ khí thử',
          departmentId: 'K.KTCK',
          majorId: 'KTPM',
          cohortYear: '2024',
          advisorId: null,
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'MAJOR_DEPARTMENT_MISMATCH' });
    await expect(
      updateClass(
        {
          classId: 'TSTHT2511',
          className: 'HTTT K2025 thử',
          departmentId: 'K.CNTT',
          majorId: 'KHONGCO',
          cohortYear: '2025',
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'MAJOR_NOT_FOUND' });
    // Khoa chưa có danh mục ngành: lớp không có ngành vẫn tạo được.
    await createClass(
      {
        classId: 'TSTCK2411',
        className: 'Cơ khí thử',
        departmentId: 'K.KTCK',
        majorId: null,
        cohortYear: '2024',
        advisorId: null,
      },
      ACTOR,
    );
  });
});

describe('Lọc theo ngành ở màn Admin', () => {
  it('cảnh báo, tổng quan và sinh viên theo ngành khớp nhau', async () => {
    const all = await listAdminAlerts(DEMO.hk1, 'ALL', null, firstPage({ size: 100 }));
    expect(all.total).toBeGreaterThan(0);
    const ktpm = await listAdminAlerts(
      DEMO.hk1,
      'ALL',
      { departmentId: 'K.CNTT', majorId: 'KTPM' },
      firstPage({ size: 100 }),
    );
    expect(ktpm.total).toBe(all.total);
    const httt = await listAdminAlerts(DEMO.hk1, 'ALL', { majorId: 'HTTT' });
    expect(httt.total).toBe(0);

    const overview = await getAdminOverview(DEMO.hk1, 'K.CNTT', 'KTPM');
    const summary = overview.summary;
    expect(summary.waiting + summary.following + summary.done).toBe(ktpm.total);
    const empty = await getAdminOverview(DEMO.hk1, 'K.CNTT', 'HTTT');
    expect(empty.summary.waiting + empty.summary.following + empty.summary.done).toBe(0);

    expect((await searchStudents('TSTK2411', firstPage(), { majorId: 'KTPM' })).total).toBe(20);
    expect((await searchStudents('TSTK2411', firstPage(), { majorId: 'HTTT' })).total).toBe(0);
  });
});
