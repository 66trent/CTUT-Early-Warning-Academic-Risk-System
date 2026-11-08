import { Brackets, In, Not } from 'typeorm';
import { getDataSource } from '@/db/data-source';
import { Alert } from '@/db/entities/alert.entity';
import { Student } from '@/db/entities/student.entity';
import { Term } from '@/db/entities/term.entity';
import { AlertStatus, type OfficialAcademicStatus, type Severity } from '@/db/enums';
import {
  applyOrder,
  firstPage,
  givenNameSql,
  type ListParams,
  type Paged,
  pageOffset,
  sqlDir,
} from '@/lib/list-params';

export const STUDENT_SORT_KEYS = ['studentId', 'fullName', 'classId'] as const;
export type StudentSortKey = (typeof STUDENT_SORT_KEYS)[number];
const STUDENT_SORT_COLUMNS: Record<StudentSortKey, string> = {
  studentId: 's.studentId',
  // Tên rồi họ (người dùng chốt 2026-10-19).
  fullName: givenNameSql('s.full_name'),
  classId: 's.classId',
};

export interface StudentSearchItemDto {
  studentId: string;
  fullName: string;
  classId: string;
  officialAcademicStatus: OfficialAcademicStatus;
  /** Mức cảnh báo ở học kỳ hiện tại; null khi không có cảnh báo hoặc chưa đặt học kỳ hiện tại. */
  currentSeverity: Severity | null;
}

/** Ký tự đặc biệt của LIKE → thoát, để tìm đúng chuỗi người dùng gõ. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Mức cảnh báo ở học kỳ hiện tại của các sinh viên trong 1 trang danh sách. */
async function currentSeverities(studentIds: string[]): Promise<Map<string, Severity>> {
  const ds = await getDataSource();
  const term = await ds.getRepository(Term).findOneBy({ isCurrent: true });
  if (!term || studentIds.length === 0) return new Map();
  const alerts = await ds.getRepository(Alert).find({
    where: {
      termId: term.termId,
      studentId: In(studentIds),
      status: Not(AlertStatus.INVALIDATED),
    },
    select: { studentId: true, severity: true },
  });
  return new Map(alerts.map((a) => [a.studentId, a.severity]));
}

/**
 * Admin tìm sinh viên theo mã / họ tên (chứa chuỗi, không phân biệt hoa thường), lọc theo ngành của
 * lớp sinh hoạt (docs/rules/09, Phase 9a).
 */
export async function searchStudents(
  query: string,
  list: ListParams<StudentSortKey> = firstPage(),
  filter: { majorId?: string | null } = {},
): Promise<Paged<StudentSearchItemDto>> {
  const qb = (await getDataSource())
    .getRepository(Student)
    .createQueryBuilder('s')
    .skip(pageOffset(list))
    .take(list.size);
  const ties: [string, 'ASC' | 'DESC'][] =
    list.sort === 'fullName' ? [['s.fullName', sqlDir(list.dir)]] : [];
  applyOrder(qb, STUDENT_SORT_COLUMNS[list.sort ?? 'classId'], list.dir, ...ties, [
    's.studentId',
    'ASC',
  ]);
  const q = query.trim();
  if (q) {
    qb.where(
      new Brackets((w) => {
        w.where('s.studentId ILIKE :q', { q: `%${escapeLike(q)}%` }).orWhere('s.fullName ILIKE :q');
      }),
    );
  }
  if (filter.majorId) {
    // Subquery thay vì join: skip/take + join làm TypeORM bọc truy vấn và hỏng ORDER BY (bẫy #24).
    qb.andWhere(
      's.classId IN (SELECT class_id FROM administrative_classes WHERE major_id = :majorId)',
      { majorId: filter.majorId },
    );
  }
  const [students, total] = await qb.getManyAndCount();
  const severityOf = await currentSeverities(students.map((s) => s.studentId));
  return {
    items: students.map((s) => ({
      studentId: s.studentId,
      fullName: s.fullName,
      classId: s.classId,
      officialAcademicStatus: s.officialAcademicStatus,
      currentSeverity: severityOf.get(s.studentId) ?? null,
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
