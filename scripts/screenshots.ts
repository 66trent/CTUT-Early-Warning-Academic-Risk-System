/**
 * npm run screenshots — chụp màn hình cho báo cáo + kiểm tra responsive (Phase 7, cập nhật 9c).
 * Cần app ở http://localhost:3000 (DEMO_MODE=true) và bộ demo v3 đã chạy 2 mốc (học kỳ còn mở):
 *   npm run demo:reset -- --yes --evaluate=2 && npm run screenshots
 * Bộ ảnh sau chốt học kỳ (luật học lực ACA-02/03/04 — chỉ có sau chốt, bẫy #31):
 *   npm run demo:reset -- --yes --evaluate && npm run screenshots -- --closed
 * Ảnh lưu `docs/screenshots/<chủ đề>-<khổ màn hình>-<tên>.jpg`; báo trang nào bị tràn ngang.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { type Browser, type BrowserContext, chromium, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const OUT = path.resolve('docs/screenshots');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;
type ViewportName = keyof typeof VIEWPORTS;

interface Shot {
  name: string;
  account: string | null;
  url: string;
  /** Thao tác trước khi chụp (VD mở chi tiết cảnh báo). */
  before?: (page: Page) => Promise<void>;
  /** Khổ màn hình chụp; mặc định chỉ desktop. */
  viewports?: ViewportName[];
}

const ALL: ViewportName[] = ['desktop', 'tablet', 'mobile'];
const openAlert = (studentId: string) => async (page: Page) => {
  // Khổ lớn: dòng bảng; điện thoại (< 768px): thẻ trong danh sách (docs/rules/07).
  await page
    .locator('tr:visible, li:visible')
    .filter({ hasText: studentId })
    .getByRole('button', { name: 'Xem' })
    .first()
    .click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(800);
};

/** Sinh viên demo có nhiều dấu hiệu nhất (bộ demo v3 — KET_QUA_MONG_DOI.md). */
const DEMO_STUDENT = 'KTPM2411903';
const ADMIN = 'Quản trị viên';
const GV001 = 'Cố vấn học tập GV001';
const GV003 = 'Cố vấn học tập GV003';

const SHOTS: Shot[] = [
  { name: '01-dang-nhap', account: null, url: '/login', viewports: ALL },
  { name: '02-bat-dau', account: ADMIN, url: '/admin/getting-started' },
  { name: '03-tong-quan', account: ADMIN, url: '/admin', viewports: ALL },
  { name: '04-nhap-du-lieu', account: ADMIN, url: '/admin/imports', viewports: ALL },
  {
    name: '05-xem-truoc-lo-nhap',
    account: ADMIN,
    url: '/admin/imports?type=ATTENDANCE_SUMMARY',
    before: async (page) => {
      await page
        .getByRole('link', { name: /\.(csv|xlsx)$/ })
        .first()
        .click();
      await page.waitForURL(/\/admin\/imports\/[0-9a-f-]{36}/);
    },
  },
  { name: '06-cau-hinh-luat', account: ADMIN, url: '/admin/rules' },
  { name: '07-cau-hinh-att-01', account: ADMIN, url: '/admin/rules/ATT-01', viewports: ALL },
  { name: '08-chay-danh-gia', account: ADMIN, url: '/admin/evaluations' },
  {
    name: '09-ket-qua-danh-gia',
    account: ADMIN,
    url: '/admin/evaluations',
    before: async (page) => {
      await page
        .getByRole('link', { name: /\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}/ })
        .first()
        .click();
      await page.waitForURL(/\/admin\/evaluations\/[0-9a-f-]{36}/);
    },
  },
  { name: '10-canh-bao-admin', account: ADMIN, url: '/admin/alerts' },
  { name: '11-ho-so-sinh-vien', account: ADMIN, url: `/admin/students/${DEMO_STUDENT}` },
  { name: '12-khoa-va-lop', account: ADMIN, url: '/admin/classes' },
  { name: '13-tai-khoan', account: ADMIN, url: '/admin/users' },
  { name: '14-nhat-ky', account: ADMIN, url: '/admin/audit-logs' },
  { name: '15-cvht-tong-quan', account: GV001, url: '/advisor', viewports: ALL },
  { name: '16-cvht-danh-sach', account: GV001, url: '/advisor/alerts', viewports: ALL },
  {
    name: '17-cvht-chi-tiet',
    account: GV001,
    url: '/advisor/alerts',
    before: openAlert(DEMO_STUDENT),
    viewports: ALL,
  },
  { name: '18-cvht-ma-tran', account: GV001, url: '/advisor/matrix', viewports: ALL },
  { name: '19-cvht-ho-so', account: GV001, url: `/advisor/students/${DEMO_STUDENT}` },
  { name: '20-cvht-thong-bao', account: GV001, url: '/advisor/notifications' },
  { name: '21-sinh-vien', account: `Sinh viên ${DEMO_STUDENT}`, url: '/student', viewports: ALL },
  { name: '22-chinh-sach', account: null, url: '/legal/privacy-policy' },
];

/** Sau chốt học kỳ: luật học lực của lớp HTTT (học lại, sa sút qua học kỳ) và KTPM (A = 3,8). */
const CLOSED_SHOTS: Shot[] = [
  { name: '30-canh-bao-nganh-httt', account: ADMIN, url: '/admin/alerts?major=HTTT' },
  {
    name: '31-cvht-chi-tiet-hoc-luc',
    account: GV003,
    url: '/advisor/alerts',
    before: openAlert('HTTT2411908'),
  },
  { name: '32-ho-so-sa-sut', account: GV003, url: '/advisor/students/HTTT2411908' },
  { name: '33-ho-so-diem-a', account: ADMIN, url: '/admin/students/KTPM2411918' },
];

async function login(page: Page, account: string): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.getByRole('tab', { name: 'Cán bộ' }).click();
  await page.getByRole('button', { name: account, exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

type Session = Awaited<ReturnType<BrowserContext['storageState']>>;
const sessions = new Map<string, Session>();

/** Đăng nhập 1 lần / tài khoản rồi dùng lại phiên (tránh giới hạn tần suất đăng nhập). */
async function sessionOf(browser: Browser, account: string): Promise<Session> {
  const cached = sessions.get(account);
  if (cached) return cached;
  const context = await browser.newContext();
  await login(await context.newPage(), account);
  const state = await context.storageState();
  await context.close();
  sessions.set(account, state);
  return state;
}

async function capture(
  browser: Browser,
  shots: Shot[],
  theme: 'light' | 'dark',
  overflow: string[],
) {
  for (const shot of shots) {
    for (const vp of shot.viewports ?? ['desktop']) {
      if (theme === 'dark' && vp !== 'desktop') continue; // chế độ tối: chụp khổ desktop
      const context = await browser.newContext({
        storageState: shot.account ? await sessionOf(browser, shot.account) : undefined,
        viewport: VIEWPORTS[vp],
        colorScheme: theme,
        locale: 'vi-VN',
        timezoneId: 'Asia/Ho_Chi_Minh',
      });
      await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
      const page = await context.newPage();
      await page.goto(`${BASE}${shot.url}`);
      await page.waitForLoadState('networkidle');
      if (shot.before) await shot.before(page);
      await page.waitForTimeout(600);
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      if (wide) overflow.push(`${shot.name} (${vp}, ${theme})`);
      await page.screenshot({
        path: path.join(OUT, `${theme}-${vp}-${shot.name}.jpg`),
        fullPage: vp !== 'mobile',
        type: 'jpeg',
        quality: 80,
      });
      await context.close();
    }
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const overflow: string[] = [];
  try {
    if (process.argv.includes('--closed')) {
      await capture(browser, CLOSED_SHOTS, 'light', overflow);
    } else {
      await capture(browser, SHOTS, 'light', overflow);
      await capture(browser, SHOTS, 'dark', overflow);
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(`Đã chụp vào ${OUT}\n`);
  process.stdout.write(
    overflow.length === 0
      ? 'Không trang nào bị tràn ngang.\n'
      : `Tràn ngang: ${overflow.join('; ')}\n`,
  );
  if (overflow.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
