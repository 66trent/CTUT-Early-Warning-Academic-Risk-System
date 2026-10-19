import { expect, test } from '@playwright/test';
import { quickLogin } from './helpers';

/**
 * Luồng 2 (docs/rules/02): Cố vấn học tập mở cảnh báo → xác nhận đã xem → ghi can thiệp →
 * cảnh báo chuyển "Đang xử lý". Đổi trạng thái cảnh báo demo — chạy `demo:reset` sau đó nếu cần
 * trạng thái ban đầu. Cần đã có cảnh báo của KTPM2311002 (tự tạo sau `demo:reset`).
 */
test('Cố vấn học tập xác nhận cảnh báo và ghi can thiệp', async ({ page }) => {
  await quickLogin(page, 'Cố vấn học tập GV001');
  await expect(page).toHaveURL(/\/advisor/);
  await page.goto('/advisor/alerts');

  const row = page.getByRole('row', { name: /KTPM2311002/ });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Xem' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Trần Thị Bích')).toBeVisible();

  const acknowledge = sheet.getByRole('button', { name: 'Xác nhận đã xem' });
  if (await acknowledge.isVisible()) {
    await acknowledge.click();
    await expect(sheet.getByText('Đã xác nhận').first()).toBeVisible();
  }

  const content = `Gọi điện hỏi lý do vắng (e2e ${Date.now()}), sinh viên cam kết đi học đầy đủ.`;
  await sheet.getByLabel('Nội dung đã trao đổi').fill(content);
  await sheet.getByRole('button', { name: 'Lưu can thiệp' }).click();
  await expect(sheet.getByText(content)).toBeVisible();
  await expect(sheet.getByText('Đang xử lý').first()).toBeVisible();
});
