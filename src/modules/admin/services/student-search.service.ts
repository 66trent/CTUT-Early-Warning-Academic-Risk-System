import { Brackets } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { Student } from '@/db/entities/student.entity';
import { type OfficialAcademicStatus } from '@/db/enums';
import { applyOrder, firstPage, type ListParams, type Paged, pageOffset } from '@/lib/list-params';

export const STUDENT_SORT_KEYS = ['studentId', 'fullName', 'classId'] as const;
export type StudentSortKey = (typeof STUDENT_SORT_KEYS)[number];
const STUDENT_SORT_COLUMNS: Record<StudentSortKey, string> = {
  studentId: 's.studentId',
  fullName: 's.fullName',
  classId: 's.classId',
};

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
  list: ListParams<StudentSortKey> = firstPage(),
): Promise<Paged<StudentSearchItemDto>> {
  const qb = (await getDataSource())
    .getRepository(Student)
    .createQueryBuilder('s')
    .skip(pageOffset(list))
    .take(list.size);
  applyOrder(qb, STUDENT_SORT_COLUMNS[list.sort ?? 'classId'], list.dir, ['s.studentId', 'ASC']);
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
    page: list.page,
    size: list.size,
  };
}

/** Chữ có dấu tiếng Việt → không dấu, dùng trong SQL (không cần extension `unaccent`). */
const VN_FROM = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const VN_TO = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
const foldSql = (column: string) => `translate(lower(${column}), '${VN_FROM}', '${VN_TO}')`;

/** Bỏ dấu + chữ thường ở phía ứng dụng — khớp với `foldSql`. */
export const foldVietnamese = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export const QUICK_SEARCH_LIMIT = 8;

export interface QuickSearchStudentDto {
  studentId: string;
  fullName: string;
  classId: string;
}

/**
 * Tìm nhanh (Ctrl+K) theo MSSV hoặc họ tên, gõ không dấu cũng được. `advisorId` khác null → chỉ
 * sinh viên thuộc lớp sinh hoạt CVHT đó đang phụ trách (docs/rules/06, lọc ở server).
 */
export async function quickSearchStudents(
  query: string,
  advisorId: string | null,
): Promise<QuickSearchStudentDto[]> {
  const q = foldVietnamese(query.trim());
  if (q.length < 2) return [];
  const like = `%${escapeLike(q)}%`;
  const qb = (await getDataSource())
    .getRepository(Student)
    .createQueryBuilder('s')
    .select(['s.studentId', 's.fullName', 's.classId'])
    .where(
      new Brackets((w) => {
        w.where('lower(s.studentId) LIKE :like', { like }).orWhere(
          `${foldSql('s.full_name')} LIKE :like`,
        );
      }),
    )
    .orderBy(`CASE WHEN lower(s.student_id) LIKE :prefix THEN 0 ELSE 1 END`, 'ASC')
    .addOrderBy('s.studentId', 'ASC')
    .setParameter('prefix', `${escapeLike(q)}%`)
    .limit(QUICK_SEARCH_LIMIT);
  if (advisorId) {
    qb.innerJoin('s.administrativeClass', 'c').andWhere('c.advisorId = :advisorId', { advisorId });
  }
  const rows = await qb.getMany();
  return rows.map((s) => ({ studentId: s.studentId, fullName: s.fullName, classId: s.classId }));
}
