import { describe, expect, it } from 'vitest';
import { CourseResultStatus, QuizAttemptStatus } from '@/db/enums';
import { letterFromScore } from '@/modules/data-import/parsing/grade-scale';
import { parseMinutes, parseScore } from '@/modules/data-import/parsing/values';
import { attendanceImport } from '@/modules/data-import/types/attendance.import';
import { courseResultImport } from '@/modules/data-import/types/course-result.import';
import { lmsQuizImport } from '@/modules/data-import/types/lms-quiz.import';

const opts = { decimalComma: false };

describe('Thang điểm chữ 9 mức — mốc nửa điểm so bằng số nguyên', () => {
  it.each([
    [10, 'A+'],
    [9.5, 'A+'],
    [9.4, 'A'],
    [8.5, 'A'],
    [8.4, 'B+'],
    [8.0, 'B+'],
    [7.9, 'B'],
    [7.0, 'B'],
    [6.9, 'C+'],
    [6.5, 'C+'],
    [6.4, 'C'],
    [5.5, 'C'],
    [5.4, 'D+'],
    [5.0, 'D+'],
    [4.9, 'D'],
    [4.0, 'D'],
    [3.9, 'F'],
    [0, 'F'],
  ])('%s → %s', (score, letter) => {
    expect(letterFromScore(score)).toBe(letter);
  });
});

describe('Chuẩn hóa dạng xuất LMS Việt Nam', () => {
  it('điểm gộp 8/10 tách thành điểm và thang', () => {
    expect(parseScore('8/10', false)).toEqual({ ok: true, value: { score: 8, maxScore: 10 } });
    expect(parseScore('7,5', true)).toEqual({ ok: true, value: { score: 7.5, maxScore: null } });
    expect(parseScore('8/10/2', false).ok).toBe(false);
  });

  it('thời lượng "12 phút" → 12', () => {
    expect(parseMinutes('12 phút', false)).toEqual({ ok: true, value: 12 });
    expect(parseMinutes('12', false)).toEqual({ ok: true, value: 12 });
    expect(parseMinutes('mười phút', false).ok).toBe(false);
  });
});

const attendance = (over: Record<string, string> = {}) => ({
  mssv: 'ktpm2311001',
  ma_hoc_phan: 'ktpm201',
  ten_hoc_phan: 'Công nghệ phần mềm',
  ngay_chot: '2026-10-09',
  tong_buoi: '16',
  co_mat: '12',
  di_tre: '1',
  vang_co_phep: '1',
  vang_khong_phep: '2',
  tong_buoi_ke_hoach: '30',
  ma_lop_hoc_phan: 'KTPM201-01',
  ...over,
});

describe('Điểm danh tổng hợp — parseRow', () => {
  it('dòng hợp lệ: mã viết hoa, số nguyên, ngày chuẩn', () => {
    const parsed = attendanceImport.parseRow(attendance(), opts);
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        studentId: 'KTPM2311001',
        courseId: 'KTPM201',
        snapshotDate: '2026-10-09',
        totalSessions: 16,
        plannedSessions: 30,
        unexcusedAbsence: 2,
      },
    });
  });

  it('có mặt + trễ + vắng vượt tổng số buổi → OUT_OF_RANGE', () => {
    expect(attendanceImport.parseRow(attendance({ co_mat: '14' }), opts)).toMatchObject({
      ok: false,
      reason: 'OUT_OF_RANGE',
    });
  });

  it('số buổi kế hoạch nhỏ hơn số buổi đã học → OUT_OF_RANGE', () => {
    expect(attendanceImport.parseRow(attendance({ tong_buoi_ke_hoach: '10' }), opts)).toMatchObject(
      { ok: false, reason: 'OUT_OF_RANGE' },
    );
  });

  it('số âm → OUT_OF_RANGE; chữ → INVALID_FORMAT', () => {
    expect(attendanceImport.parseRow(attendance({ di_tre: '-1' }), opts)).toMatchObject({
      reason: 'OUT_OF_RANGE',
    });
    expect(attendanceImport.parseRow(attendance({ di_tre: 'hai' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
  });

  it('ngày kiểu Mỹ do Excel tự đổi → INVALID_FORMAT kèm hướng dẫn', () => {
    const parsed = attendanceImport.parseRow(attendance({ ngay_chot: '10/9/2026' }), opts);
    expect(parsed).toMatchObject({ ok: false, reason: 'INVALID_FORMAT' });
    expect(!parsed.ok && parsed.detail).toContain('YYYY-MM-DD');
  });
});

const lms = (over: Record<string, string> = {}) => ({
  mssv: 'KTPM2311001',
  ma_hoc_phan: 'KTPM201',
  ma_bai: 'q01',
  ten_bai: 'Kiểm tra chương 1',
  lan_lam: '1',
  thoi_diem_bat_dau: '08:00 14/09/2026',
  thoi_diem_nop: '2026-09-14 08:20',
  thoi_gian_lam_phut: '20 phút',
  diem: '8/10',
  diem_toi_da: '',
  trang_thai: 'Đã nộp',
  ...over,
});

describe('Bài kiểm tra LMS — parseRow', () => {
  it('chuẩn hóa dạng LMS Việt Nam: giờ trước ngày, 8/10, 20 phút, Đã nộp', () => {
    expect(lmsQuizImport.parseRow(lms(), opts)).toMatchObject({
      ok: true,
      value: {
        quizKey: 'Q01',
        startedAt: '2026-09-14T08:00:00+07:00',
        submittedAt: '2026-09-14T08:20:00+07:00',
        durationMinutes: 20,
        score: 8,
        maxScore: 10,
        status: QuizAttemptStatus.SUBMITTED,
      },
    });
  });

  it('không có mã bài → khóa = tên bài bỏ dấu, chữ thường', () => {
    const parsed = lmsQuizImport.parseRow(lms({ ma_bai: '', ten_bai: 'Kiểm  tra Chương 1' }), opts);
    expect(parsed).toMatchObject({ ok: true, value: { quizKey: 'kiem tra chuong 1' } });
  });

  it('đang làm: không cần thời điểm nộp và điểm', () => {
    const parsed = lmsQuizImport.parseRow(
      lms({ thoi_diem_nop: '', thoi_gian_lam_phut: '', diem: '', trang_thai: 'Đang làm' }),
      opts,
    );
    expect(parsed).toMatchObject({ ok: true, value: { status: 'IN_PROGRESS', score: null } });
  });

  it('đã nộp mà thiếu điểm → INVALID_FORMAT', () => {
    expect(lmsQuizImport.parseRow(lms({ diem: '' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
  });

  it('điểm vượt thang, nộp trước khi bắt đầu → OUT_OF_RANGE', () => {
    expect(lmsQuizImport.parseRow(lms({ diem: '11/10' }), opts)).toMatchObject({
      reason: 'OUT_OF_RANGE',
    });
    expect(lmsQuizImport.parseRow(lms({ thoi_diem_nop: '2026-09-14 07:59' }), opts)).toMatchObject({
      reason: 'OUT_OF_RANGE',
    });
  });

  it('trạng thái lạ → INVALID_FORMAT', () => {
    expect(lmsQuizImport.parseRow(lms({ trang_thai: 'Xong' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
  });
});

const result = (over: Record<string, string> = {}) => ({
  mssv: 'KTPM2311009',
  ma_hoc_phan: 'KTPM103',
  ten_hoc_phan: 'Mạng máy tính',
  so_tin_chi: '3',
  diem_qua_trinh: '3.5',
  diem_thi: '2.5',
  diem_tong_ket: '2.9',
  diem_chu: 'F',
  ket_qua: 'KHONG_DAT',
  ngay_cong_bo: '2026-06-10',
  ...over,
});

describe('Kết quả học phần — parseRow', () => {
  it('đầy đủ → FINAL, không đạt, không cảnh báo', () => {
    const parsed = courseResultImport.parseRow(result(), opts);
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        resultStatus: CourseResultStatus.FINAL,
        letterGrade: 'F',
        passed: false,
        credits: 3,
        publishedAt: '2026-06-10',
      },
      warnings: [],
    });
  });

  it('chỉ có điểm quá trình → PROCESS_ONLY, chưa có kết quả', () => {
    const parsed = courseResultImport.parseRow(
      result({ diem_thi: '', diem_tong_ket: '', diem_chu: '', ket_qua: '' }),
      opts,
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: { resultStatus: 'PROCESS_ONLY', letterGrade: null, passed: null },
    });
  });

  it('trống điểm chữ và kết quả → quy đổi từ điểm tổng kết theo thang 9 mức', () => {
    const parsed = courseResultImport.parseRow(
      result({ diem_tong_ket: '6.5', diem_chu: '', ket_qua: '' }),
      opts,
    );
    expect(parsed).toMatchObject({ ok: true, value: { letterGrade: 'C+', passed: true } });
  });

  it('nhãn tiếng Việt "Đạt"/"Không đạt" được chấp nhận', () => {
    expect(
      courseResultImport.parseRow(
        result({ diem_tong_ket: '7.4', diem_chu: 'B', ket_qua: 'Đạt' }),
        opts,
      ),
    ).toMatchObject({ ok: true, value: { passed: true } });
    expect(courseResultImport.parseRow(result({ ket_qua: 'Không đạt' }), opts)).toMatchObject({
      ok: true,
      value: { passed: false },
    });
  });

  it('điểm chữ lệch điểm tổng kết → vẫn nạp theo điểm chữ, kèm cảnh báo', () => {
    const parsed = courseResultImport.parseRow(
      result({ diem_tong_ket: '7.4', diem_chu: 'B+', ket_qua: 'DAT' }),
      opts,
    );
    expect(parsed).toMatchObject({ ok: true, value: { letterGrade: 'B+' } });
    expect(parsed.ok && parsed.warnings?.map((w) => w.code)).toEqual(['LETTER_GRADE_MISMATCH']);
  });

  it('điểm ngoài [0, 10] → OUT_OF_RANGE; điểm chữ lạ → INVALID_FORMAT', () => {
    expect(courseResultImport.parseRow(result({ diem_thi: '10.5' }), opts)).toMatchObject({
      reason: 'OUT_OF_RANGE',
    });
    expect(courseResultImport.parseRow(result({ diem_chu: 'E' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
  });

  it('dòng không có điểm nào → INVALID_FORMAT', () => {
    expect(
      courseResultImport.parseRow(
        result({ diem_qua_trinh: '', diem_thi: '', diem_tong_ket: '', diem_chu: '', ket_qua: '' }),
        opts,
      ),
    ).toMatchObject({ reason: 'INVALID_FORMAT' });
  });

  it('dấu phẩy thập phân khi CSV phân cách bằng ";"', () => {
    expect(
      courseResultImport.parseRow(
        result({
          diem_qua_trinh: '7,5',
          diem_tong_ket: '',
          diem_chu: '',
          ket_qua: '',
          diem_thi: '',
        }),
        { decimalComma: true },
      ),
    ).toMatchObject({ ok: true, value: { processScore: 7.5 } });
  });
});
