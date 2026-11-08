/**
 * Zod cho phần phản hồi web service Moodle mà EWARS dùng (dữ liệu từ ngoài — docs/rules/02).
 * Chỉ khai báo trường cần; trường thừa được bỏ qua. Thời gian Moodle là Unix timestamp (giây, UTC).
 * Đối chiếu mã nguồn Moodle 5.3 + mod_attendance (docs/tich-hop-moodle.md mục 2).
 */
import { z } from 'zod';

const int = z.number().int();
const ts = z.number().int().nonnegative();

export const siteInfoSchema = z.object({
  sitename: z.string(),
  release: z.string(),
  username: z.string(),
  functions: z.array(z.object({ name: z.string() })),
});
export type MoodleSiteInfo = z.infer<typeof siteInfoSchema>;

export const courseSchema = z.object({
  id: int,
  shortname: z.string(),
  fullname: z.string(),
  idnumber: z.string().default(''),
  startdate: ts.default(0),
  enddate: ts.default(0),
});
export const coursesByFieldSchema = z.object({ courses: z.array(courseSchema) });
export type MoodleCourse = z.infer<typeof courseSchema>;

export const courseContentsSchema = z.array(
  z.object({
    modules: z
      .array(z.object({ modname: z.string(), instance: int, name: z.string() }))
      .default([]),
  }),
);

export const enrolledUserSchema = z.object({
  id: int,
  idnumber: z.string().optional(),
  email: z.string().optional(),
  roles: z.array(z.object({ shortname: z.string() })).default([]),
});
export const enrolledUsersSchema = z.array(enrolledUserSchema);
export type MoodleEnrolledUser = z.infer<typeof enrolledUserSchema>;

export const quizSchema = z.object({
  id: int,
  course: int,
  name: z.string(),
  timeopen: ts.default(0),
  timeclose: ts.default(0),
  /** Có từ Moodle 5.3 (hạn nộp của bài trắc nghiệm); bản cũ không có → dùng `timeclose`. */
  duedate: ts.optional(),
  grade: z.number(),
  sumgrades: z.number(),
});
export const quizzesSchema = z.object({ quizzes: z.array(quizSchema) });
export type MoodleQuiz = z.infer<typeof quizSchema>;

export const quizAttemptSchema = z.object({
  id: int,
  userid: int,
  attempt: int,
  /** `inprogress` / `overdue` / `finished` / `abandoned`. */
  state: z.string(),
  preview: int.default(0),
  timestart: ts,
  timefinish: ts.default(0),
  sumgrades: z.number().nullable().optional(),
});
export const quizAttemptsSchema = z.object({ attempts: z.array(quizAttemptSchema) });
export type MoodleQuizAttempt = z.infer<typeof quizAttemptSchema>;

export const assignmentSchema = z.object({
  id: int,
  name: z.string(),
  duedate: ts.default(0),
  cutoffdate: ts.default(0),
  allowsubmissionsfromdate: ts.default(0),
});
export const assignmentsSchema = z.object({
  courses: z.array(z.object({ id: int, assignments: z.array(assignmentSchema) })),
});
export type MoodleAssignment = z.infer<typeof assignmentSchema>;

export const submissionSchema = z.object({
  userid: int,
  /** `new` / `draft` / `submitted` / `reopened`. */
  status: z.string(),
  timemodified: ts,
});
export const submissionsSchema = z.object({
  assignments: z.array(z.object({ assignmentid: int, submissions: z.array(submissionSchema) })),
});
export type MoodleSubmission = z.infer<typeof submissionSchema>;

export const userFlagsSchema = z.object({
  assignments: z.array(
    z.object({
      assignmentid: int,
      userflags: z.array(z.object({ userid: int, extensionduedate: ts.optional() })),
    }),
  ),
});

/** Sổ điểm cả lớp (`gradereport_user_get_grade_items`, `userid=0`) — chỉ dùng dò thay đổi (Phase 10c). */
export const gradeItemsSchema = z.object({
  usergrades: z.array(
    z.object({
      userid: int,
      gradeitems: z
        .array(
          z.object({
            id: int,
            graderaw: z.number().nullable().optional(),
            gradedatesubmitted: ts.nullable().optional(),
            gradedategraded: ts.nullable().optional(),
          }),
        )
        .default([]),
    }),
  ),
});
export type MoodleGradeItems = z.infer<typeof gradeItemsSchema>;

export const attendanceSessionSchema = z.object({
  id: int,
  groupid: int.default(0),
  sessdate: ts,
  /** Giây. */
  duration: ts,
  statuses: z.array(z.object({ id: int, acronym: z.string() })),
  attendance_log: z
    .array(z.object({ studentid: z.coerce.number().int(), statusid: z.coerce.number().int() }))
    .default([]),
});
export const attendanceSessionsSchema = z.array(attendanceSessionSchema);
export type MoodleAttendanceSession = z.infer<typeof attendanceSessionSchema>;
