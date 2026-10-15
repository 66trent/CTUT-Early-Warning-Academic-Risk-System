/**
 * npm run screenshots — chụp màn hình cho báo cáo + kiểm tra responsive (Phase 7).
 * Cần app ở http://localhost:3000 (DEMO_MODE=true) và dữ liệu demo đã chạy 2 mốc chính thức:
 *   npm run demo:reset -- --yes --evaluate
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
  await page
    .getByRole('row', { name: new RegExp(studentId) })
    .getByRole('button', { name: 'Xem' })
    .click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(800);
};

const SHOTS: Shot[] = [
  { name: '01-dang-nhap', account: null, url: '/login', viewports: ALL },
  { name: '02-bat-dau', account: 'Quản trị viên', url: '/admin/getting-started' },
  { name: '03-tong-quan', account: 'Quản trị viên', url: '/admin', viewports: ALL },
  { name: '04-nhap-du-lieu', account: 'Quản trị viên', url: '/admin/imports' },
  { name: '05-cau-hinh-luat', account: 'Quản trị viên', url: '/admin/rules' },
  { name: '06-cau-hinh-att-01', account: 'Quản trị viên', url: '/admin/rules/ATT-01' },
  { name: '07-chay-danh-gia', account: 'Quản trị viên', url: '/admin/evaluations' },
  {
    name: '08-ket-qua-danh-gia',
    account: 'Quản trị viên',
    url: '/admin/evaluations',
    before: async (page) => {
      await page
        .getByRole('link', { name: /\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}/ })
        .first()
        .click();
      await page.waitForURL(/\/admin\/evaluations\/[0-9a-f-]{36}/);
    },
  },
  { name: '09-canh-bao-admin', account: 'Quản trị viên', url: '/admin/alerts' },
  { name: '10-ho-so-sinh-vien', account: 'Quản trị viên', url: '/admin/students/KTPM2311003' },
  { name: '11-nhat-ky', account: 'Quản trị viên', url: '/admin/audit-logs' },
  { name: '12-cvht-danh-sach', account: 'Cố vấn học tập GV001', url: '/advisor', viewports: ALL },
  {
    name: '13-cvht-chi-tiet',
    account: 'Cố vấn học tập GV001',
    url: '/advisor',
    before: openAlert('KTPM2311003'),
    viewports: ALL,
  },
  { name: '14-sinh-vien', account: 'Sinh viên KTPM2311003', url: '/student', viewports: ALL },
  { name: '15-chinh-sach', account: null, url: '/legal/privacy-policy' },
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

async function capture(browser: Browser, theme: 'light' | 'dark', overflow: string[]) {
  for (const shot of SHOTS) {
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
    await capture(browser, 'light', overflow);
    await capture(browser, 'dark', overflow);
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
