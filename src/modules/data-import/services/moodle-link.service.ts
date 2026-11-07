/**
 * Kết nối Moodle — trạng thái kết nối + liên kết khóa học ↔ học kỳ (Phase 10b, docs/rules/12).
 * Admin bật từng khóa (mặc định tắt); chỉ khóa có Course ID number 12 chữ số (= mã lớp học phần).
 */
import { getDataSource } from '@/db/data-source';
import { MoodleCourseLink } from '@/db/entities/moodle-course-link.entity';
import { Term } from '@/db/entities/term.entity';
import { writeAuditLog } from '@/lib/audit';
import { getEnv, isMoodleConfigured } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { createMoodleClient, type MoodleClient, MoodleError } from '../moodle/client';
import { listMoodleCourses } from '../moodle/fetch-course';
import { type MoodleCourse, siteInfoSchema } from '../moodle/schemas';
import { deriveCourseCode } from '../types/academic-row';

export const SECTION_CODE_PATTERN = /^\d{12}$/;

/** Client theo biến môi trường; chưa cấu hình → lỗi nghiệp vụ (trang hiện hướng dẫn). */
export function getMoodleClientFromEnv(): MoodleClient {
  const env = getEnv();
  if (!isMoodleConfigured(env) || !env.MOODLE_BASE_URL || !env.MOODLE_WS_TOKEN) {
    throw new AppError(
      'MOODLE_NOT_CONFIGURED',
      'Chưa cấu hình MOODLE_BASE_URL và MOODLE_WS_TOKEN.',
    );
  }
  return createMoodleClient({ baseUrl: env.MOODLE_BASE_URL, token: env.MOODLE_WS_TOKEN });
}

/** Thông báo lỗi Moodle dễ hiểu cho Admin (KHÔNG chứa token). */
export function describeMoodleError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof MoodleError) {
    if (error.code === 'invalidtoken') return 'Token web service không hợp lệ hoặc đã bị thu hồi.';
    if (error.code === 'accessexception')
      return 'Tài khoản dịch vụ thiếu quyền hoặc hàm chưa được cấp.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Lỗi không xác định khi gọi Moodle.';
}

export interface MoodleConnectionDto {
  configured: boolean;
  baseUrl: string | null;
  ok: boolean;
  siteName: string | null;
  release: string | null;
  username: string | null;
  functionCount: number;
  error: string | null;
}

export async function getMoodleConnection(client?: MoodleClient): Promise<MoodleConnectionDto> {
  const env = getEnv();
  const empty = { siteName: null, release: null, username: null, functionCount: 0 };
  if (!client && !isMoodleConfigured(env)) {
    return { configured: false, baseUrl: null, ok: false, ...empty, error: null };
  }
  const baseUrl = env.MOODLE_BASE_URL ?? null;
  try {
    const info = siteInfoSchema.parse(
      await (client ?? getMoodleClientFromEnv()).call('core_webservice_get_site_info'),
    );
    return {
      configured: true,
      baseUrl,
      ok: true,
      siteName: info.sitename,
      release: info.release,
      username: info.username,
      functionCount: info.functions.length,
      error: null,
    };
  } catch (error) {
    return { configured: true, baseUrl, ok: false, ...empty, error: describeMoodleError(error) };
  }
}

export interface MoodleCourseRowDto {
  moodleCourseId: number;
  shortname: string;
  fullname: string;
  idnumber: string;
  /** Course ID number đúng 12 chữ số → liên kết được. */
  linkable: boolean;
  link: {
    id: string;
    enabled: boolean;
    sectionCode: string;
    courseId: string;
    courseName: string;
    totalPeriodsOverride: number | null;
    lastSyncAt: string | null;
    lastError: string | null;
    unknownStudents: { idnumber: string | null; email: string | null }[];
  } | null;
}

function toLinkDto(link: MoodleCourseLink): NonNullable<MoodleCourseRowDto['link']> {
  return {
    id: link.id,
    enabled: link.enabled,
    sectionCode: link.sectionCode,
    courseId: link.courseId,
    courseName: link.courseName,
    totalPeriodsOverride: link.totalPeriodsOverride,
    lastSyncAt: link.lastSyncAt?.toISOString() ?? null,
    lastError: link.lastError,
    unknownStudents: link.unknownStudents.map((u) => ({ idnumber: u.idnumber, email: u.email })),
  };
}

/**
 * Danh sách khóa học Moodle + liên kết với học kỳ đang chọn. Khóa đã liên kết mà không còn trên
 * Moodle vẫn hiện (để Admin tắt).
 */
export async function listMoodleCourseRows(
  termId: string,
  client: MoodleClient = getMoodleClientFromEnv(),
): Promise<MoodleCourseRowDto[]> {
  const [courses, links] = await Promise.all([
    listMoodleCourses(client),
    (await getDataSource()).getRepository(MoodleCourseLink).find({ where: { termId } }),
  ]);
  const byCourse = new Map(links.map((l) => [l.moodleCourseId, l]));
  const rows: MoodleCourseRowDto[] = courses.map((c) => {
    const link = byCourse.get(c.id);
    byCourse.delete(c.id);
    return {
      moodleCourseId: c.id,
      shortname: c.shortname,
      fullname: c.fullname,
      idnumber: c.idnumber.trim(),
      linkable: SECTION_CODE_PATTERN.test(c.idnumber.trim()),
      link: link ? toLinkDto(link) : null,
    };
  });
  for (const link of byCourse.values()) {
    rows.push({
      moodleCourseId: link.moodleCourseId,
      shortname: link.moodleShortname,
      fullname: `${link.moodleFullname} (không còn trên Moodle)`,
      idnumber: link.sectionCode,
      linkable: false,
      link: toLinkDto(link),
    });
  }
  // Khóa liên kết được lên trước, theo mã lớp học phần.
  return rows.sort(
    (a, b) => Number(b.linkable) - Number(a.linkable) || a.idnumber.localeCompare(b.idnumber),
  );
}

/** Tên học phần mặc định từ tên khóa Moodle: bỏ phần nhóm / học kỳ ("Mạng máy tính (nhóm 01) — HK1"). */
export function defaultCourseName(fullname: string): string {
  return (
    fullname
      .split(/\s+[(—–-]\s*/)[0]
      ?.trim()
      .slice(0, 150) || fullname.slice(0, 150)
  );
}

export interface SetMoodleLinkInput {
  termId: string;
  moodleCourseId: number;
  enabled: boolean;
  courseId?: string;
  courseName?: string;
  totalPeriodsOverride?: number | null;
}

async function findMoodleCourse(
  client: MoodleClient,
  moodleCourseId: number,
): Promise<MoodleCourse> {
  const course = (await listMoodleCourses(client)).find((c) => c.id === moodleCourseId);
  if (!course)
    throw new AppError('MOODLE_COURSE_NOT_FOUND', 'Không tìm thấy khóa học trên Moodle.');
  return course;
}

/** Bật/tắt + sửa thông tin liên kết; lần đầu bật lấy Course ID number, tên từ Moodle. Ghi Audit Log. */
export async function setMoodleLink(
  input: SetMoodleLinkInput,
  actorId: string,
  client?: MoodleClient,
): Promise<void> {
  const dataSource = await getDataSource();
  const term = await dataSource.getRepository(Term).findOneBy({ termId: input.termId });
  if (!term) throw new AppError('TERM_NOT_FOUND', 'Không tìm thấy học kỳ.');
  if (term.closedAt) throw new AppError('TERM_CLOSED', `${term.termName} đã chốt.`);
  const repo = dataSource.getRepository(MoodleCourseLink);
  let link = await repo.findOneBy({ termId: input.termId, moodleCourseId: input.moodleCourseId });
  if (!link) {
    const course = await findMoodleCourse(client ?? getMoodleClientFromEnv(), input.moodleCourseId);
    const sectionCode = course.idnumber.trim();
    if (!SECTION_CODE_PATTERN.test(sectionCode)) {
      throw new AppError(
        'INVALID_SECTION_CODE',
        `Khóa "${course.fullname}" chưa có Course ID number 12 chữ số (mã lớp học phần) trên Moodle.`,
      );
    }
    link = repo.create({
      moodleCourseId: course.id,
      termId: input.termId,
      sectionCode,
      courseId: deriveCourseCode(sectionCode),
      courseName: defaultCourseName(course.fullname),
      moodleShortname: course.shortname.slice(0, 255),
      moodleFullname: course.fullname.slice(0, 255),
      enabled: false,
      totalPeriodsOverride: null,
      unknownStudents: [],
      updatedBy: actorId,
    });
  }
  const before = {
    enabled: link.enabled,
    courseId: link.courseId,
    courseName: link.courseName,
    totalPeriodsOverride: link.totalPeriodsOverride,
  };
  link.enabled = input.enabled;
  if (input.courseId !== undefined) link.courseId = input.courseId;
  if (input.courseName !== undefined) link.courseName = input.courseName;
  if (input.totalPeriodsOverride !== undefined)
    link.totalPeriodsOverride = input.totalPeriodsOverride;
  link.updatedBy = actorId;
  await dataSource.transaction(async (em) => {
    const saved = await em.save(link);
    await writeAuditLog(
      {
        actorId,
        action: 'MOODLE_LINK_UPDATED',
        targetType: 'MoodleCourseLink',
        targetId: saved.id,
        detail: {
          termId: saved.termId,
          sectionCode: saved.sectionCode,
          before,
          after: {
            enabled: saved.enabled,
            courseId: saved.courseId,
            courseName: saved.courseName,
            totalPeriodsOverride: saved.totalPeriodsOverride,
          },
        },
      },
      em,
    );
  });
}
