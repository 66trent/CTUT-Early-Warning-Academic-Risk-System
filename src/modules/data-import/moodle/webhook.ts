/**
 * Kiểm sự kiện plugin `local_ewars` gửi sang (thuần — Phase 10c, docs/tich-hop-moodle.md 4b, 6).
 * Chữ ký: `X-EWARS-Signature: sha256=<hex>` = HMAC-SHA256(khóa bí mật, `<timestamp>.<thân>`),
 * `X-EWARS-Timestamp` = Unix giây; lệch > 5 phút → từ chối (chống gửi lại). Sự kiện chỉ là "chuông
 * báo" (tên sự kiện + mã số), không có điểm / họ tên — EWARS luôn gọi lại web service lấy dữ liệu.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const SIGNATURE_HEADER = 'x-ewars-signature';
export const TIMESTAMP_HEADER = 'x-ewars-timestamp';
export const MAX_CLOCK_SKEW_SECONDS = 300;
export const MAX_EVENT_BYTES = 16 * 1024;

/** Bảng 4b — plugin bắt đúng các sự kiện này (`integrations/moodle/local_ewars/db/events.php`). */
export const MOODLE_EVENT_NAMES = [
  '\\mod_attendance\\event\\attendance_taken',
  '\\mod_attendance\\event\\attendance_taken_by_student',
  '\\mod_attendance\\event\\session_added',
  '\\mod_attendance\\event\\session_updated',
  '\\mod_attendance\\event\\session_deleted',
  '\\mod_attendance\\event\\session_duration_updated',
  '\\mod_attendance\\event\\session_report_updated',
  '\\mod_attendance\\event\\sessions_imported',
  '\\core\\event\\course_module_created',
  '\\core\\event\\course_module_updated',
  '\\core\\event\\course_module_deleted',
  '\\mod_quiz\\event\\attempt_started',
  '\\mod_quiz\\event\\attempt_submitted',
  '\\mod_quiz\\event\\attempt_abandoned',
  '\\mod_quiz\\event\\attempt_regraded',
  '\\mod_quiz\\event\\attempt_deleted',
  '\\mod_quiz\\event\\user_override_created',
  '\\mod_quiz\\event\\user_override_updated',
  '\\mod_quiz\\event\\user_override_deleted',
  '\\mod_assign\\event\\assessable_submitted',
  '\\mod_assign\\event\\submission_status_updated',
  '\\mod_assign\\event\\submission_removed',
  '\\mod_assign\\event\\extension_granted',
  '\\mod_assign\\event\\user_override_created',
  '\\mod_assign\\event\\user_override_updated',
  '\\mod_assign\\event\\user_override_deleted',
  '\\core\\event\\user_enrolment_created',
  '\\core\\event\\user_enrolment_updated',
  '\\core\\event\\user_enrolment_deleted',
] as const;
const KNOWN = new Set<string>(MOODLE_EVENT_NAMES);

export const moodleEventSchema = z.object({
  /** UUID plugin sinh cho mỗi sự kiện — chống nhận trùng khi Moodle thử lại. */
  id: z.uuid(),
  eventname: z.string().min(1).max(120),
  courseid: z.number().int().positive(),
  objectid: z.number().int().nullable().optional(),
  timecreated: z.number().int().positive(),
});
export type MoodleEventPayload = z.infer<typeof moodleEventSchema>;

export const isKnownMoodleEvent = (name: string): boolean => KNOWN.has(name);

export function signMoodleEvent(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

export type SignatureCheck = 'OK' | 'MISSING' | 'STALE' | 'BAD_SIGNATURE';

export function verifyMoodleSignature(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now: Date;
}): SignatureCheck {
  if (!input.timestamp || !input.signature) return 'MISSING';
  if (!/^\d{1,12}$/.test(input.timestamp)) return 'BAD_SIGNATURE';
  const ts = Number(input.timestamp);
  if (Math.abs(input.now.getTime() / 1000 - ts) > MAX_CLOCK_SKEW_SECONDS) return 'STALE';
  const expected = Buffer.from(signMoodleEvent(input.secret, ts, input.body));
  const actual = Buffer.from(input.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual)
    ? 'OK'
    : 'BAD_SIGNATURE';
}
