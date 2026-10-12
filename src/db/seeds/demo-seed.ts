import { type DataSource } from 'typeorm';
import { type Auth } from '@/lib/auth';
import { vnEndOfDay, vnStartOfDay } from '@/lib/dates';
import { staffDomainForSamples } from '@/lib/email-domains';
import { type Env } from '@/lib/env';
import { AdministrativeClass } from '../entities/administrative-class.entity';
import { Term } from '../entities/term.entity';
import { UserRole } from '../enums';
import { ensureStaffAccount } from './base-seed';

/**
 * Dữ liệu nền demo — đúng bảng "Dữ liệu nền" trong docs/demo-data/KET_QUA_MONG_DOI.md.
 * Đổi dữ liệu demo: sửa file kết quả mong đợi trước, rồi mới sửa ở đây.
 */
export const DEMO_ADVISORS = [
  { userId: 'GV001', fullName: 'Cố vấn học tập GV001' },
  { userId: 'GV002', fullName: 'Cố vấn học tập GV002' },
] as const;

export const DEMO_CLASSES = [
  {
    classId: 'KTPM2311',
    className: 'Kỹ thuật phần mềm K2023',
    departmentId: 'K.CNTT',
    cohortYear: '2023',
    advisorId: 'GV001',
  },
  {
    classId: 'KHMT2311',
    className: 'Khoa học máy tính K2023',
    departmentId: 'K.CNTT',
    cohortYear: '2023',
    advisorId: 'GV002',
  },
] as const;

export const DEMO_TERMS = [
  {
    termId: 'HK2_2025',
    termName: 'Học kỳ 2, 2025–2026',
    academicYear: '2025-2026',
    startDate: '2026-01-05',
    endDate: '2026-05-31',
  },
  {
    termId: 'HK1_2026',
    termName: 'Học kỳ 1, 2026–2027',
    academicYear: '2026-2027',
    startDate: '2026-08-17',
    endDate: '2026-12-27',
  },
] as const;

export const DEMO_CURRENT_TERM_ID = 'HK1_2026';

export interface DemoSeedReport {
  advisorsCreated: number;
}

/**
 * Idempotent: chạy lại không tạo trùng; lớp (CVHT), học kỳ (ngày, chưa chốt, học kỳ hiện tại)
 * được đưa về đúng giá trị demo trong `docs/demo-data/KET_QUA_MONG_DOI.md`.
 */
export async function seedDemo(
  dataSource: DataSource,
  auth: Auth,
  env: Env,
): Promise<DemoSeedReport> {
  if (!env.DEMO_MODE || !env.DEMO_ADVISOR_PASSWORD) {
    throw new Error('seed:demo chỉ chạy khi DEMO_MODE=true và có DEMO_ADVISOR_PASSWORD.');
  }
  const domain = staffDomainForSamples(env.STAFF_EMAIL_DOMAIN);
  let advisorsCreated = 0;
  for (const advisor of DEMO_ADVISORS) {
    const created = await ensureStaffAccount(dataSource, auth, {
      ...advisor,
      email: `${advisor.userId.toLowerCase()}${domain}`,
      role: UserRole.ADVISOR,
      password: env.DEMO_ADVISOR_PASSWORD,
    });
    if (created) advisorsCreated += 1;
  }

  await dataSource.transaction(async (em) => {
    await em.getRepository(AdministrativeClass).upsert([...DEMO_CLASSES], ['classId']);
    await em.getRepository(Term).upsert(
      DEMO_TERMS.map((t) => ({
        termId: t.termId,
        termName: t.termName,
        academicYear: t.academicYear,
        startDate: vnStartOfDay(t.startDate),
        endDate: vnEndOfDay(t.endDate),
        // Ngoại lệ CHỈ cho dữ liệu demo (DEMO_MODE): đưa học kỳ demo về chưa chốt để diễn tập lại
        // kịch bản bảo vệ. Ở chế độ thường, học kỳ đã chốt không mở lại được (docs/rules/09).
        closedAt: null,
      })),
      ['termId'],
    );
    await em.update(Term, { isCurrent: true }, { isCurrent: false });
    await em.update(Term, { termId: DEMO_CURRENT_TERM_ID }, { isCurrent: true });
  });
  return { advisorsCreated };
}
