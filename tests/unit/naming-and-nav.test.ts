import { describe, expect, it } from 'vitest';
import { isNavItemActive } from '@/components/layout/nav-config';
import { SnakeNamingStrategy, toSnakeCase } from '@/db/naming-strategy';

describe('SnakeNamingStrategy — property camelCase ↔ cột snake_case', () => {
  it.each([
    ['officialAcademicStatus', 'official_academic_status'],
    ['authUserId', 'auth_user_id'],
    ['gradePoint4', 'grade_point4'],
    ['AdministrativeClass', 'administrative_class'],
    ['ImportErrorRow', 'import_error_row'],
  ])('%s → %s', (input, expected) => {
    expect(toSnakeCase(input)).toBe(expected);
  });

  it('giữ nguyên tên tùy chỉnh và nối tên cột khóa ngoại', () => {
    const strategy = new SnakeNamingStrategy();
    expect(strategy.tableName('User', 'users')).toBe('users');
    expect(strategy.columnName('studentId', undefined, [])).toBe('student_id');
    expect(strategy.joinColumnName('student', 'studentId')).toBe('student_student_id');
  });
});

describe('Menu bên — đánh dấu mục đang chọn', () => {
  it('mục gốc của vai trò chỉ sáng khi khớp chính xác', () => {
    expect(isNavItemActive('/admin', '/admin', '/admin')).toBe(true);
    expect(isNavItemActive('/admin/users', '/admin', '/admin')).toBe(false);
  });

  it('mục con sáng cả ở trang con', () => {
    expect(isNavItemActive('/admin/users/GV001', '/admin/users', '/admin')).toBe(true);
    expect(isNavItemActive('/admin/usersx', '/admin/users', '/admin')).toBe(false);
  });
});
