import { Brackets } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { Student } from '@/db/entities/student.entity';
import { type OfficialAcademicStatus } from '@/db/enums';

export const STUDENTS_PAGE_SIZE = 50;

export interface StudentSearchItemDto {
  studentId: string;
  fullName: string;
  classId: string;
  officialAcademicStatus: OfficialAcademicStatus;
}

/** Ký tự đặc biệt của LIKE → thoát, để tìm đúng chuỗi người dùng gõ. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Admin tìm sinh viên theo mã / họ tên (chứa chuỗi, không phân biệt hoa thường). */
export async function searchStudents(
  query: string,
  page: number,
): Promise<{ items: StudentSearchItemDto[]; total: number }> {
  const qb = (await getDataSource())
    .getRepository(Student)
    .createQueryBuilder('s')
    .orderBy('s.classId', 'ASC')
    .addOrderBy('s.studentId', 'ASC')
    .skip((page - 1) * STUDENTS_PAGE_SIZE)
    .take(STUDENTS_PAGE_SIZE);
  const q = query.trim();
  if (q) {
    qb.where(
      new Brackets((w) => {
        w.where('s.studentId ILIKE :q', { q: `%${escapeLike(q)}%` }).orWhere('s.fullName ILIKE :q');
      }),
    );
  }
  const [students, total] = await qb.getManyAndCount();
  return {
    items: students.map((s) => ({
      studentId: s.studentId,
      fullName: s.fullName,
      classId: s.classId,
      officialAcademicStatus: s.officialAcademicStatus,
    })),
    total,
  };
}
