import { expect, test } from '@playwright/test';
import { confirmAction, pickOption, quickLogin } from './helpers';

/**
 * Luồng 1 (docs/rules/02): nạp 2 file điểm danh 1 lần (Phase 8f), 1 file có dòng lỗi → xem dòng
 * lỗi kèm tên file → tải file lỗi → nạp phần đúng → sửa và nạp lại → hoàn tác cả 2 lô để trả dữ
 * liệu demo về như cũ. Cần học kỳ demo CHƯA chốt (`demo:reset -- --yes --evaluate=2`).
 * Tên file KHÔNG bắt đầu bằng `tst-` (tên đó dành cho dọn dữ liệu của test tích hợp).
 */
const HEADER =
  'mssv,ho_dem,ten,ma_lop_hoc_phan,ma_hoc_phan,ten_hoc_phan,ngay_chot,tong_so_tiet,vang_co_phep,vang_khong_phep';
/** Ngày chốt mới (sau 09/10 của bộ demo) → dòng thêm mới, hoàn tác được. */
const row = (mssv: string, hoDem: string, ten: string) =>
  `${mssv},${hoDem},${ten},010100240802,,Logic học,2025-10-16,30,0,0`;
const GOOD_A = row('KTPM2411901', 'Nguyễn Minh', 'An');
const GOOD_B = row('KTPM2411905', 'Hoàng Văn', 'Em');
const BAD = row('KTPM2411999', 'Không', 'Có');
const FIXED = row('KTPM2411902', 'Trần Thị', 'Bích');

const csv = (...rows: string[]) => Buffer.from(`﻿${[HEADER, ...rows].join('\r\n')}\r\n`);

test('nạp 2 file 1 lần có dòng lỗi, tải file lỗi, sửa và nạp lại', async ({ page }) => {
  await quickLogin(page, 'Quản trị viên');

  // 1. Tải lên 2 file cùng lúc — file thứ 2 có 1 dòng sinh viên chưa có trong danh sách.
  await page.goto('/admin/imports');
  await pickOption(page, 'Loại dữ liệu', 'Điểm danh');
  await pickOption(page, 'Học kỳ', /Học kỳ 1, 2025–2026/);
  await page.locator('#import-file').setInputFiles([
    { name: 'e2e-diem-danh-a.csv', mimeType: 'text/csv', buffer: csv(GOOD_A) },
    { name: 'e2e-diem-danh-b.csv', mimeType: 'text/csv', buffer: csv(GOOD_B, BAD) },
  ]);
  await expect(page.getByText('Đã chọn 2 file')).toBeVisible();
  await page.getByRole('button', { name: 'Tải 2 file lên và kiểm tra' }).click();
  await expect(page).toHaveURL(/\/admin\/imports\/[0-9a-f-]{36}$/);
  const parentUrl = page.url();
  await expect(page.getByText('Chờ xác nhận').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Các file trong lần nạp (2)')).toBeVisible();
  await expect(page.getByText('Dòng lỗi (1)')).toBeVisible();
  await expect(page.getByText('KTPM2411999').first()).toBeVisible();

  // 2. File lỗi tải về được, có dòng sai và tên file chứa dòng đó.
  const errorHref = await page
    .getByRole('link', { name: 'Tải file lỗi để sửa' })
    .getAttribute('href');
  const errorFile = await page.request.get(errorHref ?? '');
  expect(errorFile.ok()).toBe(true);
  const errorCsv = await errorFile.text();
  expect(errorCsv).toContain('KTPM2411999');
  expect(errorCsv).toContain('e2e-diem-danh-b.csv');

  // 3. Nạp phần đúng của cả 2 file.
  await confirmAction(page, 'Xác nhận nạp 2 dòng', 'Nạp dữ liệu');
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
  await confirmAction(page, 'Xác nhận nạp 1 dòng', 'Nạp dữ liệu');
  await expect(page.getByText('Đã nạp dữ liệu')).toBeVisible({ timeout: 30_000 });

  // 5. Dọn: hoàn tác lô nạp lại rồi lô gốc.
  await confirmAction(page, 'Hoàn tác lô', 'Hoàn tác');
  await expect(page.getByText('Đã hoàn tác').first()).toBeVisible({ timeout: 30_000 });
  await page.goto(parentUrl);
  await confirmAction(page, 'Hoàn tác lô', 'Hoàn tác');
  await expect(page.getByText('Đã hoàn tác').first()).toBeVisible({ timeout: 30_000 });
});
