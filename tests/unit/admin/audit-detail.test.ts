import { describe, expect, it } from 'vitest';
import { presentAuditDetail } from '@/lib/audit-labels';

describe('Chi tiết nhật ký hệ thống', () => {
  it('khóa đã biết hiện nhãn tiếng Việt, ngày đổi sang giờ Việt Nam, mã đổi sang nhãn', () => {
    const { rows, technical } = presentAuditDetail([
      { key: 'termId', value: 'HK1_2025' },
      { key: 'mode', value: 'MANUAL' },
      { key: 'asOf', value: '2025-10-10T16:59:59.000Z' },
    ]);
    expect(rows).toEqual([
      { label: 'Học kỳ', value: 'HK1_2025' },
      { label: 'Chế độ', value: 'Thủ công' },
      { label: 'Tính đến', value: expect.stringContaining('10/10/2025') as string },
    ]);
    expect(technical).toEqual([]);
  });

  it('bỏ giá trị rỗng; JSON, mã lỗi và khóa lạ vào phần kỹ thuật', () => {
    const { rows, technical } = presentAuditDetail([
      { key: 'courseId', value: 'null' },
      { key: 'reason', value: 'INVALID_EMAIL_OR_PASSWORD' },
      { key: 'after', value: '{"enabled":true}' },
    ]);
    expect(rows).toEqual([]);
    expect(technical.map((t) => t.key)).toEqual(['reason', 'after']);
  });
});
