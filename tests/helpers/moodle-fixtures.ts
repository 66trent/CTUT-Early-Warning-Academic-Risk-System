/**
 * Máy chủ Moodle GIẢ cho test: trả phản hồi web service đã ghi từ Moodle 5.3 Docker
 * (`tests/fixtures/moodle/`, `npm run moodle:fixtures`, ngày chốt 06/11/2026) — không cần Moodle thật.
 * `transform` đổi mã thật sang mã thử (VD `KTPM2411` → `TSTL2411`) trước khi trả.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type MoodleClient,
  MoodleError,
  type MoodleParams,
} from '@/modules/data-import/moodle/client';

const DIR = 'tests/fixtures/moodle';

interface Recorded {
  params: MoodleParams;
  response: unknown;
}

/** JSON có khóa sắp xếp — so khớp tham số không phụ thuộc thứ tự khóa. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const scalar = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export function fixtureCutoff(): string {
  const meta = JSON.parse(readFileSync(join(DIR, '_meta.json'), 'utf8')) as Recorded[];
  return (meta[0]?.response as { dataCutoff: string }).dataCutoff;
}

export interface FixtureClientOptions {
  transform?: (json: string) => string;
  /** Sửa phản hồi đã đọc (VD thêm 1 người dùng chưa có trong EWARS). */
  patch?: (fn: string, params: MoodleParams, response: unknown) => unknown;
}

export interface FixtureMoodleClient extends MoodleClient {
  calls: { fn: string; params: MoodleParams }[];
}

export function createFixtureMoodleClient(options: FixtureClientOptions = {}): FixtureMoodleClient {
  const transform = options.transform ?? ((s: string) => s);
  const byFn = new Map<string, Recorded[]>();
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
    byFn.set(
      file.replace(/\.json$/, ''),
      JSON.parse(transform(readFileSync(join(DIR, file), 'utf8'))) as Recorded[],
    );
  }
  const calls: FixtureMoodleClient['calls'] = [];
  return {
    calls,
    call<T>(fn: string, params: MoodleParams = {}): Promise<T> {
      calls.push({ fn, params });
      const recorded = byFn.get(fn) ?? [];
      let response: unknown;
      if (fn === 'core_course_get_courses_by_field') {
        // Moodle thật lọc theo field; fixture ghi theo idnumber → gộp rồi tự lọc.
        const all = recorded.flatMap((r) => (r.response as { courses: { id: number }[] }).courses);
        const unique = [...new Map(all.map((c) => [c.id, c])).values()];
        const field = params.field as string | undefined;
        response = {
          courses: field
            ? unique.filter(
                (c) => String((c as Record<string, unknown>)[field]) === scalar(params.value),
              )
            : unique,
          warnings: [],
        };
      } else {
        const hit = recorded.find((r) => stable(r.params) === stable(params));
        if (!hit) {
          return Promise.reject(
            new MoodleError('fixture_missing', `Fixture không có ${fn}(${stable(params)})`),
          );
        }
        response = hit.response;
      }
      const patched = options.patch ? options.patch(fn, params, response) : response;
      return Promise.resolve(structuredClone(patched) as T);
    },
  };
}
