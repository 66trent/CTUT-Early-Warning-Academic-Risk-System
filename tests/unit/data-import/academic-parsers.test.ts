import { describe, expect, it } from 'vitest';
import { QuizAttemptStatus, SubmissionStatus } from '@/db/enums';
import { letterFromScore } from '@/modules/data-import/parsing/grade-scale';
import { parseMinutes, parseScore } from '@/modules/data-import/parsing/values';
import { deriveCourseCode, nameKey } from '@/modules/data-import/types/academic-row';
import { attendanceImport } from '@/modules/data-import/types/attendance.import';
import { courseResultImport } from '@/modules/data-import/types/course-result.import';
import { lmsAssignmentImport } from '@/modules/data-import/types/lms-assignment.import';
import { lmsQuizImport, NOT_STARTED } from '@/modules/data-import/types/lms-quiz.import';

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

describe('Cột chung: mã học phần tự suy, họ tên đối chiếu', () => {
  it('mã học phần = mã lớp học phần bỏ 2 số cuối (giả định — docs/rules/12)', () => {
    expect(deriveCourseCode('010100240802')).toBe('0101002408');
  });

  it('so khớp họ tên: bỏ dấu, chữ thường, gộp khoảng trắng', () => {
    expect(nameKey('  Đặng   Minh Tú ')).toBe(nameKey('dang minh tu'));
    expect(nameKey('Đặng Minh Tuấn')).not.toBe(nameKey('Đặng Minh Tú'));
  });
});

const attendance = (over: Record<string, string> = {}) => ({
  mssv: 'ktpm2411902',
  ho_dem: 'Trần Thị',
  ten: 'Bích',
  ma_lop_hoc_phan: '010100240802',
  ma_hoc_phan: '',
  ten_hoc_phan: 'Logic học',
  ngay_chot: '2025-10-09',
  tong_so_tiet: '30',
  vang_co_phep: '1',
  vang_khong_phep: '2',
  ty_le_vang: '10.00',
  ...over,
});

describe('Điểm danh (tiết) — parseRow', () => {
  it('dòng hợp lệ: mã viết hoa, mã học phần tự suy, số tiết, họ tên để đối chiếu', () => {
    const parsed = attendanceImport.parseRow(attendance(), opts);
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        studentId: 'KTPM2411902',
        courseId: '0101002408',
        derivedCode: true,
        sectionCode: '010100240802',
        givenName: 'Trần Thị Bích',
        snapshotDate: '2025-10-09',
        totalPeriods: 30,
        excusedAbsence: 1,
        unexcusedAbsence: 2,
      },
      warnings: [],
    });
  });

  it('có cột mã học phần → dùng đúng mã đó, không tự suy', () => {
    expect(attendanceImport.parseRow(attendance({ ma_hoc_phan: 'LOGIC01' }), opts)).toMatchObject({
      ok: true,
      value: { courseId: 'LOGIC01', derivedCode: false },
    });
  });

  it('tiết vắng vượt tổng số tiết → OUT_OF_RANGE; số âm → OUT_OF_RANGE; chữ → INVALID_FORMAT', () => {
    expect(attendanceImport.parseRow(attendance({ vang_khong_phep: '30' }), opts)).toMatchObject({
      ok: false,
      reason: 'OUT_OF_RANGE',
    });
    expect(attendanceImport.parseRow(attendance({ vang_co_phep: '-1' }), opts)).toMatchObject({
      reason: 'OUT_OF_RANGE',
    });
    expect(attendanceImport.parseRow(attendance({ vang_co_phep: 'hai' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
  });

  it('tỷ lệ vắng trong file lệch số tính lại → cảnh báo (không chặn), dạng "22,22 %" được nhận', () => {
    const parsed = attendanceImport.parseRow(attendance({ ty_le_vang: '15' }), opts);
    expect(parsed.ok && parsed.warnings?.map((w) => w.code)).toEqual(['ABSENCE_RATE_MISMATCH']);
    expect(attendanceImport.parseRow(attendance({ ty_le_vang: '10,00 %' }), opts)).toMatchObject({
      ok: true,
      warnings: [],
    });
  });

  it('thiếu mã lớp học phần → INVALID_FORMAT; ngày kiểu Mỹ do Excel tự đổi → INVALID_FORMAT', () => {
    expect(attendanceImport.parseRow(attendance({ ma_lop_hoc_phan: '' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
    const parsed = attendanceImport.parseRow(attendance({ ngay_chot: '10/9/2025' }), opts);
    expect(parsed).toMatchObject({ ok: false, reason: 'INVALID_FORMAT' });
    expect(!parsed.ok && parsed.detail).toContain('YYYY-MM-DD');
  });
});

const quiz = (over: Record<string, string> = {}) => ({
  mssv: 'KTPM2411901',
  ma_lop_hoc_phan: '010100240802',
  ma_bai: 'tn01',
  ten_bai: 'Trắc nghiệm chương 1',
  han_nop: '2025-09-20',
  lan_lam: '1',
  thoi_diem_bat_dau: '08:00 14/09/2025',
  thoi_diem_nop: '2025-09-14 08:20',
  thoi_gian_lam_phut: '20 phút',
  diem: '8/10',
  diem_toi_da: '',
  so_cau_dung: '8',
  tong_so_cau: '10',
  trang_thai: 'Đã nộp',
  ...over,
});

describe('Bài trắc nghiệm LMS — parseRow', () => {
  it('chuẩn hóa: giờ trước ngày, 8/10, 20 phút, Đã nộp; hạn nộp chỉ ngày → 23:59', () => {
    expect(lmsQuizImport.parseRow(quiz(), opts)).toMatchObject({
      ok: true,
      value: {
        activityKey: 'TN01',
        dueAt: '2025-09-20T23:59:00+07:00',
        startedAt: '2025-09-14T08:00:00+07:00',
        submittedAt: '2025-09-14T08:20:00+07:00',
        durationMinutes: 20,
        score: 8,
        maxScore: 10,
        correctCount: 8,
        totalQuestions: 10,
        status: QuizAttemptStatus.SUBMITTED,
      },
    });
  });

  it('"Chưa làm" / Moodle "Never submitted" → không cần thời điểm, điểm', () => {
    for (const label of ['Chưa làm', 'Never submitted']) {
      expect(
        lmsQuizImport.parseRow(
          quiz({
            lan_lam: '',
            thoi_diem_bat_dau: '',
            thoi_diem_nop: '',
            diem: '',
            trang_thai: label,
          }),
          opts,
        ),
      ).toMatchObject({ ok: true, value: { status: NOT_STARTED, startedAt: null } });
    }
  });

  it('không có mã bài → khóa = tên bài bỏ dấu; lần làm trống được phép', () => {
    const parsed = lmsQuizImport.parseRow(
      quiz({ ma_bai: '', ten_bai: 'Trắc  nghiệm Chương 1', lan_lam: '' }),
      opts,
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: { activityKey: 'trac nghiem chuong 1', attemptNumber: null },
    });
  });

  it('đã nộp mà thiếu điểm → INVALID_FORMAT; số câu đúng vượt tổng → OUT_OF_RANGE', () => {
    expect(lmsQuizImport.parseRow(quiz({ diem: '' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
    expect(lmsQuizImport.parseRow(quiz({ so_cau_dung: '11' }), opts)).toMatchObject({
      reason: 'OUT_OF_RANGE',
    });
  });

  it('điểm vượt thang, nộp trước khi bắt đầu → OUT_OF_RANGE; trạng thái lạ → INVALID_FORMAT', () => {
    expect(lmsQuizImport.parseRow(quiz({ diem: '11/10' }), opts)).toMatchObject({
      reason: 'OUT_OF_RANGE',
    });
    expect(lmsQuizImport.parseRow(quiz({ thoi_diem_nop: '2025-09-14 07:59' }), opts)).toMatchObject(
      { reason: 'OUT_OF_RANGE' },
    );
    expect(lmsQuizImport.parseRow(quiz({ trang_thai: 'Xong' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
  });

  it('hạn nộp phải giống nhau giữa các dòng cùng bài (khóa đối chiếu)', () => {
    const a = lmsQuizImport.parseRow(quiz(), opts);
    const b = lmsQuizImport.parseRow(quiz({ mssv: 'KTPM2411902', han_nop: '2025-09-21' }), opts);
    if (!a.ok || !b.ok) throw new Error('parse');
    const [ca, cb] = [lmsQuizImport.consistency?.(a.value), lmsQuizImport.consistency?.(b.value)];
    expect(ca?.key).toBe(cb?.key);
    expect(ca?.value).not.toBe(cb?.value);
  });
});

const assignment = (over: Record<string, string> = {}) => ({
  mssv: 'KTPM2411909',
  ma_lop_hoc_phan: '010100239401',
  ma_bai: 'TH01',
  ten_bai: 'Thực hành 1: Nhập xuất',
  han_nop: '2025-09-25',
  trang_thai_nop: 'Nộp trễ',
  thoi_diem_nop: '2025-09-27 21:00',
  ...over,
});

describe('Bài thực hành LMS — parseRow', () => {
  it('Nộp trễ có thời điểm nộp → hợp lệ, không cảnh báo', () => {
    expect(lmsAssignmentImport.parseRow(assignment(), opts)).toMatchObject({
      ok: true,
      value: {
        activityKey: 'TH01',
        dueAt: '2025-09-25T23:59:00+07:00',
        status: SubmissionStatus.LATE,
        submittedAt: '2025-09-27T21:00:00+07:00',
      },
      warnings: [],
    });
  });

  it('Chưa nộp / Moodle "No submission" → không cần thời điểm nộp', () => {
    for (const label of ['Chưa nộp', 'No submission']) {
      expect(
        lmsAssignmentImport.parseRow(
          assignment({ trang_thai_nop: label, thoi_diem_nop: '' }),
          opts,
        ),
      ).toMatchObject({
        ok: true,
        value: { status: SubmissionStatus.NOT_SUBMITTED, submittedAt: null },
      });
    }
  });

  it('đã nộp mà thiếu thời điểm nộp → INVALID_FORMAT; thiếu hạn nộp → INVALID_FORMAT', () => {
    expect(lmsAssignmentImport.parseRow(assignment({ thoi_diem_nop: '' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
    expect(lmsAssignmentImport.parseRow(assignment({ han_nop: '' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
  });

  it('ghi "Đã nộp" nhưng thời điểm nộp sau hạn → cảnh báo SUBMISSION_STATUS_MISMATCH', () => {
    const parsed = lmsAssignmentImport.parseRow(assignment({ trang_thai_nop: 'Đã nộp' }), opts);
    expect(parsed.ok && parsed.warnings?.map((w) => w.code)).toEqual([
      'SUBMISSION_STATUS_MISMATCH',
    ]);
  });
});

const result = (over: Record<string, string> = {}) => ({
  mssv: 'KTPM2411913',
  ho_dem: 'Huỳnh Văn',
  ten: 'Nam',
  ma_lop_hoc_phan: '010100240802',
  ten_hoc_phan: 'Logic học',
  so_tin_chi: '2',
  diem_thuong_xuyen: '3.0',
  duoc_du_thi: 'Không',
  diem_cuoi_ky: '',
  vang_thi: 'Không',
  thang_diem_4: '0.0',
  diem_chu: 'F',
  ngay_cong_bo: '2025-11-16',
  ...over,
});

describe('Kết quả học phần (đã khóa điểm) — parseRow', () => {
  it('không được dự thi → F, không đạt, cờ cấm thi', () => {
    expect(courseResultImport.parseRow(result(), opts)).toMatchObject({
      ok: true,
      value: {
        courseId: '0101002408',
        letterGrade: 'F',
        passed: false,
        eligibleForExam: false,
        absentFromExam: false,
        credits: 2,
        publishedAt: '2025-11-16',
      },
      warnings: [],
    });
  });

  it('thang điểm 4 lệch quy đổi (A phải là 3,8) → cảnh báo, nạp theo điểm chữ', () => {
    const parsed = courseResultImport.parseRow(
      result({ diem_chu: 'A', thang_diem_4: '4.0', duoc_du_thi: 'Có', diem_cuoi_ky: '9' }),
      opts,
    );
    expect(parsed).toMatchObject({ ok: true, value: { letterGrade: 'A', passed: true } });
    expect(parsed.ok && parsed.warnings?.map((w) => w.code)).toEqual(['GRADE_POINT_MISMATCH']);
    expect(
      courseResultImport.parseRow(result({ diem_chu: 'A', thang_diem_4: '3,80' }), opts),
    ).toMatchObject({ ok: true, warnings: [] });
  });

  it('thiếu điểm chữ / điểm chữ lạ / thiếu tín chỉ → INVALID_FORMAT; điểm ngoài [0, 10] → OUT_OF_RANGE', () => {
    const cases: Record<string, string>[] = [
      { diem_chu: '' },
      { diem_chu: 'E' },
      { so_tin_chi: '' },
    ];
    for (const over of cases) {
      expect(courseResultImport.parseRow(result(over), opts)).toMatchObject({
        reason: 'INVALID_FORMAT',
      });
    }
    expect(courseResultImport.parseRow(result({ diem_cuoi_ky: '10.5' }), opts)).toMatchObject({
      reason: 'OUT_OF_RANGE',
    });
  });

  it('ô có/không nhận "x", "1", "TRUE"; giá trị lạ → INVALID_FORMAT', () => {
    expect(courseResultImport.parseRow(result({ vang_thi: 'x' }), opts)).toMatchObject({
      ok: true,
      value: { absentFromExam: true },
    });
    expect(courseResultImport.parseRow(result({ vang_thi: 'có lẽ' }), opts)).toMatchObject({
      reason: 'INVALID_FORMAT',
    });
  });

  it('dấu phẩy thập phân khi CSV phân cách bằng ";"', () => {
    expect(
      courseResultImport.parseRow(result({ diem_thuong_xuyen: '7,5' }), { decimalComma: true }),
    ).toMatchObject({ ok: true, value: { processScore: 7.5 } });
  });
});

describe('Phát hiện file bị lưu sai bảng mã (mất dấu tiếng Việt)', () => {
  it('họ tên "Tr??ng Minh Thu?n" → INVALID_FORMAT kèm hướng dẫn lưu CSV UTF-8', async () => {
    const { studentImport } = await import('@/modules/data-import/types/student.import');
    const parsed = studentImport.parseRow(
      {
        mssv: 'KTPM2411919',
        ho_ten: 'Tr??ng Minh Thu?n',
        email: 'ktpm2411919@student.ctuet.edu.vn',
        ma_lop_sinh_hoat: 'KTPM2411',
        trang_thai_hoc_vu: 'ACTIVE',
      },
      opts,
    );
    expect(parsed).toMatchObject({ ok: false, reason: 'INVALID_FORMAT' });
    expect(!parsed.ok && parsed.detail).toContain('CSV UTF-8');
  });

  it('tên học phần có "?" → INVALID_FORMAT', () => {
    expect(
      attendanceImport.parseRow(attendance({ ten_hoc_phan: 'L?gic h?c' }), opts),
    ).toMatchObject({ ok: false, reason: 'INVALID_FORMAT' });
  });
});
