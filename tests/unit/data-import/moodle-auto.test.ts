import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { nextDepartures } from '@/modules/data-import/moodle/departures';
import {
  courseFingerprint,
  type MoodleCourseBase,
} from '@/modules/data-import/moodle/fetch-course';
import {
  isKnownMoodleEvent,
  MOODLE_EVENT_NAMES,
  signMoodleEvent,
  verifyMoodleSignature,
} from '@/modules/data-import/moodle/webhook';
import { handleMoodleEventRequest } from '@/modules/data-import/services/moodle-event.service';
import { activitiesOf } from '@/modules/data-import/services/moodle-sync.service';

const SECRET = 'k'.repeat(40);
const NOW = new Date('2026-11-08T03:00:00Z');
const ts = Math.floor(NOW.getTime() / 1000);

describe('Chữ ký sự kiện Moodle (HMAC-SHA256 + dấu thời gian)', () => {
  const body = '{"a":1}';
  const check = (over: Partial<Parameters<typeof verifyMoodleSignature>[0]>) =>
    verifyMoodleSignature({
      secret: SECRET,
      timestamp: String(ts),
      signature: signMoodleEvent(SECRET, ts, body),
      body,
      now: NOW,
      ...over,
    });

  it('đúng khóa, đúng thân, đúng giờ → OK', () => expect(check({})).toBe('OK'));
  it('sửa thân sau khi ký → BAD_SIGNATURE', () =>
    expect(check({ body: '{"a":2}' })).toBe('BAD_SIGNATURE'));
  it('sai khóa → BAD_SIGNATURE', () =>
    expect(check({ signature: signMoodleEvent('x'.repeat(40), ts, body) })).toBe('BAD_SIGNATURE'));
  it('lệch > 5 phút → STALE (chống gửi lại)', () => {
    const old = ts - 301;
    expect(check({ timestamp: String(old), signature: signMoodleEvent(SECRET, old, body) })).toBe(
      'STALE',
    );
  });
  it('thiếu header → MISSING; dấu thời gian không phải số → BAD_SIGNATURE', () => {
    expect(check({ signature: null })).toBe('MISSING');
    expect(check({ timestamp: '12a' })).toBe('BAD_SIGNATURE');
  });
});

describe('Endpoint sự kiện Moodle', () => {
  const allow = vi.fn(() => Promise.resolve({ allowed: true, retryAfterSeconds: 0 }));
  const event = {
    id: randomUUID(),
    eventname: '\\mod_quiz\\event\\attempt_submitted',
    courseid: 14,
    objectid: 77,
    timecreated: ts - 30,
  };
  const request = (body: string, signature = signMoodleEvent(SECRET, ts, body)) => ({
    body,
    now: NOW,
    headers: new Headers({ 'x-ewars-timestamp': String(ts), 'x-ewars-signature': signature }),
  });

  it('chưa đặt khóa bí mật → 404 (tính năng tắt)', async () => {
    const res = await handleMoodleEventRequest(request('{}'), { secret: null, rateLimit: allow });
    expect(res.status).toBe(404);
  });

  it('hợp lệ → ghi hộp thư, trả 200; chữ ký sai → 401, không ghi', async () => {
    const record = vi.fn(() => Promise.resolve({ duplicate: false, queuedTerms: ['HK'] }));
    const body = JSON.stringify(event);
    const ok = await handleMoodleEventRequest(request(body), {
      secret: SECRET,
      rateLimit: allow,
      record,
    });
    expect(ok).toEqual({ status: 200, body: { ok: true, duplicate: false } });
    expect(record).toHaveBeenCalledWith(
      {
        eventId: event.id,
        eventName: event.eventname,
        moodleCourseId: 14,
        objectId: 77,
        occurredAt: new Date((ts - 30) * 1000),
      },
      NOW,
    );
    record.mockClear();
    const bad = await handleMoodleEventRequest(request(body, 'sha256=00'), {
      secret: SECRET,
      rateLimit: allow,
      record,
    });
    expect(bad.status).toBe(401);
    expect(record).not.toHaveBeenCalled();
  });

  it('sự kiện ngoài bảng 4b → 202 bỏ qua; thiếu trường → 400; quá tần suất → 429', async () => {
    const record = vi.fn();
    const other = JSON.stringify({ ...event, eventname: '\\core\\event\\user_loggedin' });
    expect(
      (await handleMoodleEventRequest(request(other), { secret: SECRET, rateLimit: allow, record }))
        .status,
    ).toBe(202);
    const broken = JSON.stringify({ ...event, id: 'khong-phai-uuid' });
    expect(
      (
        await handleMoodleEventRequest(request(broken), {
          secret: SECRET,
          rateLimit: allow,
          record,
        })
      ).status,
    ).toBe(400);
    const deny = () => Promise.resolve({ allowed: false, retryAfterSeconds: 10 });
    expect(
      (await handleMoodleEventRequest(request(other), { secret: SECRET, rateLimit: deny, record }))
        .status,
    ).toBe(429);
    expect(record).not.toHaveBeenCalled();
  });

  it('danh sách sự kiện khớp plugin local_ewars (db/events.php)', async () => {
    const { readFileSync } = await import('node:fs');
    const php = readFileSync('integrations/moodle/local_ewars/db/events.php', 'utf8');
    const inPlugin = [...php.matchAll(/'(\\[a-z_]+\\event\\[a-z_]+)'/g)].map((m) => m[1]);
    expect([...inPlugin].sort()).toEqual([...MOODLE_EVENT_NAMES].sort());
    expect(isKnownMoodleEvent('\\mod_assign\\event\\assessable_submitted')).toBe(true);
  });
});

describe('Rời khóa / bài đã xóa trên Moodle (chỉ liệt kê, không tự xóa)', () => {
  const quiz = { kind: 'QUIZ' as const, id: 1, name: 'Bài 1' };
  const assign = { kind: 'ASSIGNMENT' as const, id: 2, name: 'Thực hành 1' };
  const empty = { seenStudentIds: [], leftStudents: [], seenActivities: [], removedActivities: [] };

  it('lần kéo đầu không báo ai', () => {
    const next = nextDepartures(empty, ['SV1', 'SV2'], [quiz, assign], NOW);
    expect(next).toMatchObject({ leftStudents: [], removedActivities: [] });
    expect(next.seenStudentIds).toEqual(['SV1', 'SV2']);
  });

  it('không còn ở lần sau → vào danh sách; quay lại → bỏ khỏi danh sách', () => {
    const first = nextDepartures(empty, ['SV1', 'SV2'], [quiz, assign], NOW);
    const second = nextDepartures(first, ['SV1'], [quiz], NOW);
    expect(second.leftStudents).toEqual([{ studentId: 'SV2', detectedAt: NOW.toISOString() }]);
    expect(second.removedActivities).toEqual([{ ...assign, detectedAt: NOW.toISOString() }]);
    const later = new Date(NOW.getTime() + 3600_000);
    const third = nextDepartures(second, ['SV1'], [quiz], later);
    expect(third.leftStudents[0]?.detectedAt).toBe(NOW.toISOString());
    const back = nextDepartures(third, ['SV1', 'SV2'], [quiz, assign], later);
    expect(back).toMatchObject({ leftStudents: [], removedActivities: [] });
  });
});

describe('Dấu vân tay khóa học + hạn nộp', () => {
  const base: MoodleCourseBase = {
    course: {
      id: 14,
      shortname: 'MMT',
      fullname: 'Mạng máy tính',
      idnumber: '010100089201',
      startdate: 0,
      enddate: 0,
    },
    students: [{ id: 5, idnumber: 'SV1', email: 'a@x', roles: [] }],
    quizzes: [
      {
        id: 1,
        course: 14,
        name: 'Q1',
        timeopen: 0,
        timeclose: 2000,
        duedate: 1000,
        grade: 10,
        sumgrades: 10,
      },
      { id: 3, course: 14, name: 'Q2', timeopen: 0, timeclose: 0, grade: 10, sumgrades: 10 },
    ],
    assignments: [{ id: 2, name: 'A1', duedate: 3000, cutoffdate: 0, allowsubmissionsfromdate: 0 }],
    submissions: new Map([[2, new Map([[5, { userid: 5, status: 'new', timemodified: 1 }]])]]),
    extensions: new Map([[2, new Map([[5, 4000]])]]),
    sessions: [],
  };
  const grades = { usergrades: [{ userid: 5, gradeitems: [{ id: 9, graderaw: null }] }] };

  it('ổn định khi dữ liệu không đổi; đổi sổ điểm / MSSV khớp được → đổi', () => {
    const fp = courseFingerprint(base, grades, ['SV1']);
    expect(courseFingerprint(base, structuredClone(grades), ['SV1'])).toBe(fp);
    const graded = { usergrades: [{ userid: 5, gradeitems: [{ id: 9, graderaw: 7 }] }] };
    expect(courseFingerprint(base, graded, ['SV1'])).not.toBe(fp);
    expect(courseFingerprint(base, grades, [])).not.toBe(fp);
  });

  it('hạn nộp: trắc nghiệm duedate (không có thì timeclose), thực hành + gia hạn riêng', () => {
    expect(activitiesOf(base).map((a) => [a.kind, a.id, a.dues])).toEqual([
      ['QUIZ', 1, [1000]],
      ['QUIZ', 3, []],
      ['ASSIGNMENT', 2, [3000, 4000]],
    ]);
  });
});
