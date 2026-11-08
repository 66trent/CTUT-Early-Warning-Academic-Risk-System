import { describe, expect, it } from 'vitest';
import { EvaluationTrigger } from '@/db/enums';
import { describeCounts, updateTitle } from '@/modules/alerts/services/update-notification.service';

describe('Chuông "đánh giá đã cập nhật" — nội dung', () => {
  it('đếm sự kiện cảnh báo; không có gì → "không có thay đổi cảnh báo"', () => {
    expect(describeCounts({ CREATED: 2, REOPENED: 0, SEVERITY_INCREASED: 1 })).toBe(
      '2 cảnh báo mới · 1 tăng mức',
    );
    expect(describeCounts({ CREATED: 0, REOPENED: 1, SEVERITY_INCREASED: 0 })).toBe('1 mở lại');
    expect(describeCounts({ CREATED: 0, REOPENED: 0, SEVERITY_INCREASED: 0 })).toBe(
      'không có thay đổi cảnh báo',
    );
  });

  it('tiêu đề theo nguồn: Moodle / nạp file / chạy tay / lịch / chốt học kỳ', () => {
    const auto = { trigger: EvaluationTrigger.AUTO_AFTER_IMPORT, courseId: null };
    const data = {
      dataTypes: ['Điểm danh', 'Bài trắc nghiệm'],
      courseIds: ['0101000892'],
      courseNames: ['Mạng máy tính'],
    };
    expect(updateTitle(auto, { ...data, source: 'MOODLE' })).toBe(
      'Moodle: Điểm danh, Bài trắc nghiệm · Mạng máy tính vừa cập nhật',
    );
    expect(updateTitle(auto, { ...data, source: 'FILE' })).toMatch(/^Nhập file: /);
    expect(updateTitle(auto, null)).toBe('Đánh giá lại sau khi dữ liệu thay đổi');
    expect(updateTitle({ trigger: EvaluationTrigger.MANUAL, courseId: null }, null)).toBe(
      'Admin chạy đánh giá',
    );
    expect(updateTitle({ trigger: EvaluationTrigger.SCHEDULED, courseId: null }, null)).toBe(
      'Đánh giá tự động theo lịch',
    );
    expect(updateTitle({ trigger: EvaluationTrigger.TERM_CLOSING, courseId: null }, null)).toMatch(
      /^Chốt học kỳ/,
    );
  });

  it('tiêu đề dài bị cắt ≤ 200 ký tự', () => {
    const many = Array.from({ length: 40 }, (_, i) => `Học phần số ${i}`);
    const title = updateTitle(
      { trigger: EvaluationTrigger.AUTO_AFTER_IMPORT, courseId: null },
      { source: 'MOODLE', dataTypes: ['Điểm danh'], courseIds: [], courseNames: many },
    );
    expect(title.length).toBe(200);
    expect(title.endsWith('…')).toBe(true);
  });
});
