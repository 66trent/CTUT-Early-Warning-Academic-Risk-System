import { In, IsNull, Not } from 'typeorm';
import { z } from 'zod';
import { AdministrativeClass } from '@/db/entities/administrative-class.entity';
import { Enrollment } from '@/db/entities/enrollment.entity';
import { Student } from '@/db/entities/student.entity';
import { User } from '@/db/entities/user.entity';
import { OfficialAcademicStatus, UserAccountStatus, UserRole } from '@/db/enums';
import { STUDENT_EMAIL_DOMAIN } from '@/lib/email-domains';
import { transferOpenAlerts } from '@/modules/alerts/services/alert-lifecycle.service';
import { hasLostDiacritics, LOST_DIACRITICS_HINT, stripDiacritics } from '../parsing/values';
import { type ImportTypeDefinition, type ParsedRow, type RowError } from './definition';

export interface StudentRow {
  studentId: string;
  fullName: string;
  email: string;
  classId: string;
  officialAcademicStatus: OfficialAcademicStatus;
}

/** Nhãn tiếng Việt (không dấu, chữ thường) → trạng thái học vụ SIS. */
const STATUS_ALIASES: Record<string, OfficialAcademicStatus> = {
  dang_hoc: OfficialAcademicStatus.ACTIVE,
  bao_luu: OfficialAcademicStatus.RESERVED,
  dinh_chi: OfficialAcademicStatus.SUSPENDED,
  tot_nghiep: OfficialAcademicStatus.GRADUATED,
  buoc_thoi_hoc: OfficialAcademicStatus.DISMISSED,
};

function parseStatus(raw: string): OfficialAcademicStatus | null {
  const upper = raw.trim().toUpperCase();
  if ((Object.values(OfficialAcademicStatus) as string[]).includes(upper)) {
    return upper as OfficialAcademicStatus;
  }
  return STATUS_ALIASES[stripDiacritics(raw).trim().replace(/\s+/g, '_')] ?? null;
}

const emailSchema = z.email();
const invalid = (detail: string): ParsedRow<StudentRow> => ({
  ok: false,
  reason: 'INVALID_FORMAT',
  detail,
});

/**
 * Nhập danh sách sinh viên (docs/rules/12) — đường DUY NHẤT ghi `Student.officialAcademicStatus`.
 * Tạo/cập nhật `Student` + `User` (role STUDENT, ACTIVE); KHÔNG xóa sinh viên vắng mặt trong file.
 */
export const studentImport: ImportTypeDefinition<StudentRow> = {
  dataType: 'STUDENT',
  label: 'Danh sách sinh viên',
  requiresTerm: false,
  requiredColumns: ['mssv', 'ho_ten', 'email', 'ma_lop_sinh_hoat', 'trang_thai_hoc_vu'],
  optionalColumns: [],
  templatePath: '/templates/mau_sinh_vien.csv',

  parseRow(record) {
    const studentId = (record.mssv ?? '').trim().toUpperCase();
    const fullName = (record.ho_ten ?? '').trim().replace(/\s+/g, ' ');
    const email = (record.email ?? '').trim().toLowerCase();
    const classId = (record.ma_lop_sinh_hoat ?? '').trim().toUpperCase();
    const status = parseStatus(record.trang_thai_hoc_vu ?? '');

    if (!/^[A-Z0-9]{3,20}$/.test(studentId)) {
      return invalid('Mã số sinh viên gồm 3–20 chữ cái hoặc chữ số, không để trống.');
    }
    if (fullName.length < 2 || fullName.length > 100) return invalid('Họ tên từ 2 đến 100 ký tự.');
    if (hasLostDiacritics(fullName)) return invalid(`Họ tên "${fullName}" ${LOST_DIACRITICS_HINT}`);
    if (!emailSchema.safeParse(email).success || email.length > 100) {
      return invalid(`Email "${record.email ?? ''}" không hợp lệ.`);
    }
    if (!email.endsWith(STUDENT_EMAIL_DOMAIN)) {
      return invalid(`Email sinh viên phải có đuôi ${STUDENT_EMAIL_DOMAIN}.`);
    }
    if (!/^[A-Z0-9]{2,20}$/.test(classId)) return invalid('Mã lớp sinh hoạt không hợp lệ.');
    if (!status) {
      return invalid(
        'Trạng thái học vụ phải là: Đang học, Bảo lưu, Đình chỉ, Tốt nghiệp hoặc Buộc thôi học.',
      );
    }
    return {
      ok: true,
      value: { studentId, fullName, email, classId, officialAcademicStatus: status },
    };
  },

  uniqueKeys: (row) => [`mssv:${row.studentId}`, `email:${row.email}`],

  async checkReferences(rows, em) {
    const errors = new Map<number, RowError>();
    const classIds = [...new Set(rows.map((r) => r.classId))];
    const [classes, usersById, usersByEmail] = await Promise.all([
      em.find(AdministrativeClass, { select: { classId: true }, where: { classId: In(classIds) } }),
      em.find(User, {
        select: { userId: true, role: true },
        where: { userId: In(rows.map((r) => r.studentId)) },
      }),
      em.find(User, {
        select: { userId: true, email: true },
        where: { email: In(rows.map((r) => r.email)) },
      }),
    ]);
    const knownClasses = new Set(classes.map((c) => c.classId));
    const roleById = new Map(usersById.map((u) => [u.userId, u.role]));
    const ownerByEmail = new Map(usersByEmail.map((u) => [u.email, u.userId]));

    rows.forEach((row, i) => {
      if (!knownClasses.has(row.classId)) {
        errors.set(i, {
          reason: 'CLASS_NOT_FOUND',
          detail: `Lớp ${row.classId} chưa có trong hệ thống — tạo lớp trước rồi nhập lại.`,
        });
      } else if (roleById.has(row.studentId) && roleById.get(row.studentId) !== UserRole.STUDENT) {
        errors.set(i, {
          reason: 'DUPLICATE',
          detail: `Mã ${row.studentId} đã là mã của một tài khoản cán bộ.`,
        });
      } else if ((ownerByEmail.get(row.email) ?? row.studentId) !== row.studentId) {
        errors.set(i, {
          reason: 'DUPLICATE',
          detail: `Email ${row.email} đã thuộc tài khoản ${ownerByEmail.get(row.email)}.`,
        });
      }
    });
    return errors;
  },

  async load(rows, em) {
    const ids = rows.map((r) => r.studentId);
    const [users, students] = await Promise.all([
      em.find(User, { where: { userId: In(ids) } }),
      em.find(Student, { where: { studentId: In(ids) } }),
    ]);
    const userById = new Map(users.map((u) => [u.userId, u]));
    const studentById = new Map(students.map((s) => [s.studentId, s]));
    const result = { inserted: 0, updated: 0, unchanged: 0, createdKeys: [] as string[] };
    const newUsers: Partial<User>[] = [];
    const newStudents: Partial<Student>[] = [];
    const classChanges: StudentRow[] = [];

    for (const row of rows) {
      const user = userById.get(row.studentId);
      const student = studentById.get(row.studentId);
      if (!user || !student) {
        if (!user) {
          newUsers.push({
            userId: row.studentId,
            fullName: row.fullName,
            email: row.email,
            role: UserRole.STUDENT,
            accountStatus: UserAccountStatus.ACTIVE,
            authUserId: null,
          });
        }
        newStudents.push({
          studentId: row.studentId,
          fullName: row.fullName,
          classId: row.classId,
          officialAcademicStatus: row.officialAcademicStatus,
        });
        result.createdKeys.push(row.studentId);
        continue;
      }
      const changed =
        user.fullName !== row.fullName ||
        user.email !== row.email ||
        student.classId !== row.classId ||
        student.officialAcademicStatus !== row.officialAcademicStatus;
      if (!changed) {
        result.unchanged += 1;
        continue;
      }
      await em.update(
        User,
        { userId: row.studentId },
        { fullName: row.fullName, email: row.email },
      );
      await em.update(
        Student,
        { studentId: row.studentId },
        {
          fullName: row.fullName,
          classId: row.classId,
          officialAcademicStatus: row.officialAcademicStatus,
        },
      );
      result.updated += 1;
      // Đổi lớp → chuyển cảnh báo đang mở sang Cố vấn học tập của lớp mới (docs/rules/09).
      if (student.classId !== row.classId) classChanges.push(row);
    }
    for (const row of classChanges) {
      const target = await em.findOneBy(AdministrativeClass, { classId: row.classId });
      await transferOpenAlerts(em, [row.studentId], target?.advisorId ?? null, null);
    }

    // Thêm mới theo lô — 1 câu INSERT cho cả nhóm (docs/rules/05).
    if (newUsers.length > 0) await em.insert(User, newUsers);
    if (newStudents.length > 0) await em.insert(Student, newStudents);
    result.inserted = newStudents.length;
    return result;
  },

  async rollback(createdKeys, em) {
    if (createdKeys.length === 0) return null;
    const loggedIn = await em.count(User, {
      where: { userId: In([...createdKeys]), authUserId: Not(IsNull()) },
    });
    if (loggedIn > 0) {
      return `${loggedIn} sinh viên trong lô đã đăng nhập hệ thống — không hoàn tác được, hãy nạp file đúng để cập nhật.`;
    }
    const withData = await em.count(Enrollment, { where: { studentId: In([...createdKeys]) } });
    if (withData > 0) {
      return 'Sinh viên trong lô đã có dữ liệu học tập — không hoàn tác được, hãy nạp file đúng để cập nhật.';
    }
    await em.delete(Student, { studentId: In([...createdKeys]) });
    await em.delete(User, {
      userId: In([...createdKeys]),
      role: UserRole.STUDENT,
      authUserId: IsNull(),
    });
    return null;
  },
};
