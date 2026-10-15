import { expect, type Page } from '@playwright/test';

/** Đăng nhập bằng nút đăng nhập nhanh demo (chỉ khi DEMO_MODE=true). */
export async function quickLogin(page: Page, label: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Cán bộ' }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Chọn 1 mục trong Radix Select theo nhãn của ô chọn. */
export async function pickOption(
  page: Page,
  label: string,
  option: string | RegExp,
): Promise<void> {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option }).click();
}

/** Bấm nút mở hộp xác nhận rồi bấm nút xác nhận trong hộp. */
export async function confirmAction(page: Page, trigger: string, confirm: string): Promise<void> {
  await page.getByRole('button', { name: trigger, exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: confirm, exact: true }).click();
}
