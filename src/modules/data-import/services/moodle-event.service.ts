/**
 * Nhận 1 sự kiện plugin `local_ewars` (Phase 10c — docs/rules/06): giới hạn tần suất → kiểm chữ ký
 * HMAC + dấu thời gian → kiểm cấu trúc → ghi hộp thư (chống nhận trùng) → đặt job gom. Lỗi không lộ
 * chi tiết (không nhắc khóa bí mật).
 */
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { clientIpFrom, hitRateLimit } from '@/lib/rate-limit';
import {
  isKnownMoodleEvent,
  MAX_EVENT_BYTES,
  moodleEventSchema,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyMoodleSignature,
} from '../moodle/webhook';
import { recordMoodleEvent } from './moodle-auto.service';

/** 1 lớp học phần phát vài sự kiện / phút; 600 / phút / IP đủ cho cả trường gửi dồn sau khi cron chạy. */
const RATE_LIMIT = { max: 600, windowSeconds: 60 };

export interface MoodleEventResponse {
  status: number;
  body: { ok: boolean; code?: string; duplicate?: boolean };
}

export interface MoodleEventRequestDeps {
  record?: typeof recordMoodleEvent;
  rateLimit?: typeof hitRateLimit;
  /** Mặc định `MOODLE_WEBHOOK_SECRET`. */
  secret?: string | null;
}

const fail = (status: number, code: string): MoodleEventResponse => ({
  status,
  body: { ok: false, code },
});

export async function handleMoodleEventRequest(
  input: { body: string; headers: Headers; now: Date },
  deps: MoodleEventRequestDeps = {},
): Promise<MoodleEventResponse> {
  const secret = deps.secret === undefined ? getEnv().MOODLE_WEBHOOK_SECRET : deps.secret;
  if (!secret) return fail(404, 'NOT_ENABLED');
  const ip = clientIpFrom(input.headers);
  const limit = await (deps.rateLimit ?? hitRateLimit)(
    `moodle-events:${ip}`,
    RATE_LIMIT.max,
    RATE_LIMIT.windowSeconds,
  );
  if (!limit.allowed) return fail(429, 'RATE_LIMITED');
  if (Buffer.byteLength(input.body, 'utf8') > MAX_EVENT_BYTES) return fail(413, 'TOO_LARGE');

  const check = verifyMoodleSignature({
    secret,
    timestamp: input.headers.get(TIMESTAMP_HEADER),
    signature: input.headers.get(SIGNATURE_HEADER),
    body: input.body,
    now: input.now,
  });
  if (check !== 'OK') {
    logger.warn({ ip, check }, 'sự kiện Moodle bị từ chối');
    return fail(401, check);
  }
  let json: unknown;
  try {
    json = JSON.parse(input.body);
  } catch {
    return fail(400, 'INVALID_JSON');
  }
  const parsed = moodleEventSchema.safeParse(json);
  if (!parsed.success) return fail(400, 'INVALID_EVENT');
  const event = parsed.data;
  // Sự kiện ngoài bảng 4b: nhận (để plugin không thử lại) nhưng bỏ qua.
  if (!isKnownMoodleEvent(event.eventname))
    return { status: 202, body: { ok: true, code: 'IGNORED' } };
  const result = await (deps.record ?? recordMoodleEvent)(
    {
      eventId: event.id,
      eventName: event.eventname,
      moodleCourseId: event.courseid,
      objectId: event.objectid ?? null,
      occurredAt: new Date(event.timecreated * 1000),
    },
    input.now,
  );
  return { status: 200, body: { ok: true, duplicate: result.duplicate } };
}
