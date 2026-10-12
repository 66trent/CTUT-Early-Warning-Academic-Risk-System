import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type DataSource } from 'typeorm';
import { closeDataSource, getDataSource } from '@/db/data-source';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { ImportBatch } from '@/db/entities/import-batch.entity';
import { ImportErrorRow } from '@/db/entities/import-error-row.entity';
import { Student } from '@/db/entities/student.entity';
import { ImportBatchStatus, OfficialAcademicStatus } from '@/db/enums';
import { listClasses } from '@/modules/admin/services/class.service';
import { buildErrorCsv } from '@/modules/data-import/services/error-file.service';
import {
  discardImportBatch,
  expireStagedBatches,
  getRollbackEligibility,
  rollbackImportBatch,
} from '@/modules/data-import/services/import-batch.service';
import { getImportBatchDetail } from '@/modules/data-import/services/import-query.service';
import { cleanupIdentityFixtures } from '../helpers/identity-fixtures';
import {
  cleanupImportBatches,
  confirmAndLoad,
  csvToXlsx,
  demoStudentsCsv,
  IMPORT_ACTOR,
  TEST_CLASSES,
  uploadAndValidate,
  useMemoryStorage,
} from '../helpers/import-helpers';

/** DoD Phase 3a — chạy với PostgreSQL thật, file lưu trong bộ nhớ (không cần MinIO). */
let ds: DataSource;
const HEADER = 'mssv,ho_ten,email,ma_lop_sinh_hoat,trang_thai_hoc_vu';
const line = (id: string, cls = 'TSTK2311', name = 'Sinh viên thử') =>
  `${id},${name},${id.toLowerCase()}@student.ctuet.edu.vn,${cls},Đang học`;

async function cleanup() {
  await cleanupImportBatches(ds);
  await cleanupIdentityFixtures(ds);
  await ds.query(`DELETE FROM administrative_classes WHERE class_id LIKE 'TST%'`);
}

beforeAll(async () => {
  ds = await getDataSource();
  useMemoryStorage();
  await cleanup();
  await ds.getRepository(AdministrativeClass).insert(
    TEST_CLASSES.map((classId) => ({
      classId,
      className: `Lớp thử ${classId}`,
      departmentId: 'K.CNTT',
      cohortYear: '2023',
      advisorId: null,
    })),
  );
});

afterAll(async () => {
  await cleanup();
  await closeDataSource();
});

describe('Nạp danh sách sinh viên demo — 2 bước', () => {
  let batchId: string;

  it('kiểm tra file demo CSV: 13 dòng hợp lệ, 0 lỗi, CHƯA ghi dữ liệu', async () => {
    const batch = await uploadAndValidate(ds, 'tst-01_sinh_vien.csv', demoStudentsCsv());
    batchId = batch.id;
    expect(batch).toMatchObject({
      status: ImportBatchStatus.STAGED,
      totalRows: 13,
      successRows: 13,
      errorRows: 0,
    });
    expect(await ds.getRepository(Student).countBy({ classId: 'TSTK2311' })).toBe(0);
    const detail = await getImportBatchDetail(batchId);
    expect(detail?.preview).toHaveLength(5);
    expect(Object.getPrototypeOf(detail)).toBe(Object.prototype);
  });

  it('xác nhận → nạp 13 sinh viên, sĩ số lớp đúng (12 và 1)', async () => {
    const batch = await confirmAndLoad(ds, batchId);
    expect(batch.status).toBe(ImportBatchStatus.RECONCILED);
    expect(batch.summary).toMatchObject({ inserted: 13, updated: 0, unchanged: 0 });
    const classes = await listClasses();
    expect(classes.find((c) => c.classId === 'TSTK2311')?.studentCount).toBe(12);
    expect(classes.find((c) => c.classId === 'TSTH2311')?.studentCount).toBe(1);
    const student = await ds.getRepository(Student).findOneByOrFail({ studentId: 'TSTK2311001' });
    expect(student).toMatchObject({
      fullName: 'Nguyễn Minh An',
      officialAcademicStatus: OfficialAcademicStatus.ACTIVE,
    });
  });

  it('nạp lại đúng file đó → bị chặn', async () => {
    await expect(
      uploadAndValidate(ds, 'tst-01_sinh_vien.csv', demoStudentsCsv()),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_FILE',
    });
  });

  it('cùng dữ liệu lưu bằng Excel .xlsx → đọc đủ 13 dòng, nạp lại không nhân đôi', async () => {
    const batch = await uploadAndValidate(
      ds,
      'tst-01_sinh_vien.xlsx',
      await csvToXlsx(demoStudentsCsv()),
    );
    expect(batch).toMatchObject({
      status: ImportBatchStatus.STAGED,
      successRows: 13,
      errorRows: 0,
    });
    const loaded = await confirmAndLoad(ds, batch.id);
    expect(loaded.summary).toMatchObject({ inserted: 0, updated: 0, unchanged: 13 });
    expect(await ds.getRepository(Student).countBy({ classId: 'TSTK2311' })).toBe(12);
  });

  it('lô đã cập nhật dòng có sẵn → không cho hoàn tác, kèm lý do', async () => {
    const batch = await uploadAndValidate(
      ds,
      'tst-update.csv',
      `${HEADER}\n${line('TSTK2311001', 'TSTK2311', 'Tên Đã Đổi')}\n`,
    );
    const loaded = await confirmAndLoad(ds, batch.id);
    expect(loaded.summary).toMatchObject({ updated: 1 });
    const eligibility = await getRollbackEligibility(loaded);
    expect(eligibility.allowed).toBe(false);
  });
});

describe('Dòng lỗi và lỗi cả file', () => {
  it('lớp lạ → CLASS_NOT_FOUND; trùng trong file → DUPLICATE; sai định dạng → INVALID_FORMAT', async () => {
    const csv = [
      HEADER,
      line('TSTERR01', 'TSTX9999'),
      line('TSTERR02'),
      line('TSTERR02'),
      '=1+1,Ai đó,a@student.ctuet.edu.vn,TSTK2311,ACTIVE',
      'TSTERR03,Người Ngoài,x@gmail.com,TSTK2311,ACTIVE',
    ].join('\n');
    const batch = await uploadAndValidate(ds, 'tst-loi.csv', csv);
    expect(batch).toMatchObject({ status: ImportBatchStatus.STAGED, successRows: 1, errorRows: 4 });
    const errors = await ds.getRepository(ImportErrorRow).find({
      where: { importBatchId: batch.id },
      order: { sourceRowNumber: 'ASC' },
    });
    expect(errors.map((e) => [e.sourceRowNumber, e.errorReason])).toEqual([
      [2, 'CLASS_NOT_FOUND'],
      [4, 'DUPLICATE'],
      [5, 'INVALID_FORMAT'],
      [6, 'INVALID_FORMAT'],
    ]);
    expect(errors[0]?.errorDetail).toContain('TSTX9999');
    await discardImportBatch(batch.id, IMPORT_ACTOR);
  });

  it('file lỗi tải về: có BOM, lý do tiếng Việt, ô "=1+1" bị vô hiệu hóa công thức', async () => {
    const batch = await ds.getRepository(ImportBatch).findOneByOrFail({ fileName: 'tst-loi.csv' });
    const csv = await buildErrorCsv(batch.id);
    // Giữ đúng thứ tự cột của file gốc (jsonb không giữ thứ tự khóa).
    expect(csv.split('\r\n')[0]).toBe(
      '\uFEFFdong,ly_do,ma_loi,mssv,ho_ten,email,ma_lop_sinh_hoat,trang_thai_hoc_vu',
    );
    expect(csv).toContain('Lớp sinh hoạt chưa có trong hệ thống');
    expect(csv).toContain("'=1+1");
    expect(csv).not.toMatch(/(^|,)=1\+1/m);
  });

  it('thiếu cột bắt buộc → từ chối cả file, nêu tên cột', async () => {
    const batch = await uploadAndValidate(ds, 'tst-thieu-cot.csv', 'mssv,ho_ten\nTSTA001,Tên\n');
    expect(batch.status).toBe(ImportBatchStatus.REJECTED);
    expect(batch.errorMessage).toContain('email');
  });

  it('không có dòng hợp lệ nào → từ chối, vẫn tải được dòng lỗi', async () => {
    const batch = await uploadAndValidate(
      ds,
      'tst-toan-loi.csv',
      `${HEADER}\n${line('TSTERR09', 'TSTX9999')}\n`,
    );
    expect(batch.status).toBe(ImportBatchStatus.REJECTED);
    expect(batch.errorRows).toBe(1);
  });
});

describe('Hủy, kiểm tra lại khi xác nhận, hoàn tác, tự hủy', () => {
  it('hủy lô chờ xác nhận → không ghi dữ liệu nào', async () => {
    const batch = await uploadAndValidate(ds, 'tst-huy.csv', `${HEADER}\n${line('TSTHUY01')}\n`);
    await discardImportBatch(batch.id, IMPORT_ACTOR);
    expect((await ds.getRepository(ImportBatch).findOneByOrFail({ id: batch.id })).status).toBe(
      ImportBatchStatus.DISCARDED,
    );
    expect(await ds.getRepository(Student).existsBy({ studentId: 'TSTHUY01' })).toBe(false);
  });

  it('lớp bị xóa giữa lúc xem trước và xác nhận → dòng đó thành lỗi khi nạp', async () => {
    await ds.getRepository(AdministrativeClass).insert({
      classId: 'TSTZ2311',
      className: 'Lớp sẽ xóa',
      departmentId: 'K.CNTT',
      cohortYear: '2023',
      advisorId: null,
    });
    const csv = `${HEADER}\n${line('TSTRV01')}\n${line('TSTRV02', 'TSTZ2311')}\n`;
    const staged = await uploadAndValidate(ds, 'tst-revalidate.csv', csv);
    expect(staged).toMatchObject({ successRows: 2, errorRows: 0 });
    await ds.getRepository(AdministrativeClass).delete({ classId: 'TSTZ2311' });

    const loaded = await confirmAndLoad(ds, staged.id);
    expect(loaded).toMatchObject({
      status: ImportBatchStatus.RECONCILED,
      successRows: 1,
      errorRows: 1,
    });
    expect(await ds.getRepository(Student).existsBy({ studentId: 'TSTRV02' })).toBe(false);
  });

  it('hoàn tác lô chỉ thêm mới → xóa đúng sinh viên lô đã tạo', async () => {
    const batch = await uploadAndValidate(
      ds,
      'tst-rollback.csv',
      `${HEADER}\n${line('TSTRB01')}\n${line('TSTRB02')}\n`,
    );
    const loaded = await confirmAndLoad(ds, batch.id);
    expect(await getRollbackEligibility(loaded)).toEqual({ allowed: true });
    await rollbackImportBatch(batch.id, IMPORT_ACTOR);
    expect((await ds.getRepository(ImportBatch).findOneByOrFail({ id: batch.id })).status).toBe(
      ImportBatchStatus.ROLLED_BACK,
    );
    expect(await ds.getRepository(Student).existsBy({ studentId: 'TSTRB01' })).toBe(false);
    expect(await ds.getRepository(Student).existsBy({ studentId: 'TSTK2311001' })).toBe(true);
    // File đã hoàn tác được nạp lại.
    const again = await uploadAndValidate(
      ds,
      'tst-rollback.csv',
      `${HEADER}\n${line('TSTRB01')}\n${line('TSTRB02')}\n`,
    );
    expect(again.status).toBe(ImportBatchStatus.STAGED);
    await discardImportBatch(again.id, IMPORT_ACTOR);
  });

  it('lô chờ xác nhận quá 7 ngày → tự hủy', async () => {
    const batch = await uploadAndValidate(
      ds,
      'tst-qua-han.csv',
      `${HEADER}\n${line('TSTOLD01')}\n`,
    );
    await ds
      .getRepository(ImportBatch)
      .update(batch.id, { stagedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000) });
    expect(await expireStagedBatches()).toBeGreaterThanOrEqual(1);
    expect((await ds.getRepository(ImportBatch).findOneByOrFail({ id: batch.id })).status).toBe(
      ImportBatchStatus.DISCARDED,
    );
  });
});
