import { expect, test } from '@playwright/test';
import { confirmAction, pickOption, quickLogin } from './helpers';

/**
 * Luồng 1 (docs/rules/02): nhập file có lỗi → xem dòng lỗi → tải file lỗi → nạp phần đúng →
 * sửa và nạp lại → hoàn tác cả 2 lô để trả dữ liệu demo về như cũ.
 * Tên file KHÔNG bắt đầu bằng `tst-` (tên đó dành cho dọn dữ liệu của test tích hợp).
 */
const HEADER =
  'mssv,ma_hoc_phan,ten_hoc_phan,ngay_chot,tong_buoi,co_mat,di_tre,vang_co_phep,vang_khong_phep,tong_buoi_ke_hoach,ma_lop_hoc_phan';
const GOOD = 'KTPM2311001,KTPM202,Thực tập chuyên ngành,2026-10-12,4,4,0,0,0,15,KTPM202-01';
const BAD = 'KTPM2399999,KTPM202,Thực tập chuyên ngành,2026-10-12,4,4,0,0,0,15,KTPM202-01';
const FIXED = 'KTPM2311013,KTPM202,Thực tập chuyên ngành,2026-10-12,4,3,0,0,1,15,KTPM202-01';

const csv = (...rows: string[]) => Buffer.from(`﻿${[HEADER, ...rows].join('\r\n')}\r\n`);

test('nhập file có dòng lỗi, tải file lỗi, sửa và nạp lại', async ({ page }) => {
  await quickLogin(page, 'Quản trị viên');

  // 1. Tải lên file có 1 dòng sinh viên chưa có trong danh sách.
  await page.goto('/admin/imports');
  await pickOption(page, 'Loại dữ liệu', 'Điểm danh tổng hợp');
  await pickOption(page, 'Học kỳ', /Học kỳ 1, 2026–2027/);
  await page
    .locator('#import-file')
    .setInputFiles({ name: 'e2e-diem-danh.csv', mimeType: 'text/csv', buffer: csv(GOOD, BAD) });
  await page.getByRole('button', { name: 'Tải lên và kiểm tra' }).click();
  await expect(page).toHaveURL(/\/admin\/imports\/[0-9a-f-]{36}$/);
  const parentUrl = page.url();
  await expect(page.getByText('Chờ xác nhận').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Dòng lỗi (1)')).toBeVisible();
  await expect(page.getByText('KTPM2399999').first()).toBeVisible();

  // 2. File lỗi tải về được, có dòng sai.
  const errorHref = await page
    .getByRole('link', { name: 'Tải file lỗi để sửa' })
    .getAttribute('href');
  const errorFile = await page.request.get(errorHref ?? '');
  expect(errorFile.ok()).toBe(true);
  expect(await errorFile.text()).toContain('KTPM2399999');

  // 3. Nạp phần đúng.
  await confirmAction(page, 'Xác nhận nạp', 'Nạp dữ liệu');
  await expect(page.getByText('Đã nạp dữ liệu')).toBeVisible({ timeout: 30_000 });

  // 4. Sửa dòng lỗi (đổi sang sinh viên có thật) và nạp lại — chỉ dòng đã sửa được thêm.
  await page.getByRole('link', { name: 'Nạp lại file đã sửa' }).click();
  await expect(page).toHaveURL(/parent=/);
  await page
    .locator('#import-file')
    .setInputFiles({ name: 'e2e-diem-danh-da-sua.csv', mimeType: 'text/csv', buffer: csv(FIXED) });
  await page.getByRole('button', { name: 'Nạp lại file đã sửa' }).click();
  await expect(page).toHaveURL(/\/admin\/imports\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Chờ xác nhận').first()).toBeVisible({ timeout: 30_000 });
  await confirmAction(page, 'Xác nhận nạp', 'Nạp dữ liệu');
  await expect(page.getByText('Đã nạp dữ liệu')).toBeVisible({ timeout: 30_000 });

  // 5. Dọn: hoàn tác lô nạp lại rồi lô gốc.
  await confirmAction(page, 'Hoàn tác lô', 'Hoàn tác');
  await expect(page.getByText('Đã hoàn tác').first()).toBeVisible({ timeout: 30_000 });
  await page.goto(parentUrl);
  await confirmAction(page, 'Hoàn tác lô', 'Hoàn tác');
  await expect(page.getByText('Đã hoàn tác').first()).toBeVisible({ timeout: 30_000 });
});
