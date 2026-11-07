/**
 * Client Web service REST của Moodle (docs/tich-hop-moodle.md mục 2, 6).
 * - Gọi `POST {baseUrl}/webservice/rest/server.php`, token nằm trong THÂN request (không trên URL —
 *   tránh lọt vào nhật ký máy chủ), `moodlewsrestformat=json`.
 * - Tham số mảng/đối tượng mã hóa kiểu PHP: `assignmentids[0]=5`, `options[0][name]=x`.
 * - Moodle báo lỗi bằng HTTP 200 + `{ exception, errorcode, message }` → ném `MoodleError`.
 * Không phụ thuộc DB/Next — dùng được ở worker, script, test (truyền `fetchImpl` giả).
 */

export type MoodleParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly MoodleParamValue[]
  | { readonly [key: string]: MoodleParamValue };

export type MoodleParams = Readonly<Record<string, MoodleParamValue>>;

export class MoodleError extends Error {
  constructor(
    /** `errorcode` của Moodle (VD `invalidtoken`, `accessexception`) hoặc `HTTP_<status>` / `TIMEOUT`. */
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MoodleError';
  }
}

export interface MoodleClientOptions {
  baseUrl: string;
  token: string;
  /** Mặc định 20 giây / lần gọi. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface MoodleClient {
  call<T>(wsfunction: string, params?: MoodleParams): Promise<T>;
}

/** Trải tham số lồng nhau thành cặp khóa kiểu PHP (bỏ `undefined`/`null`, boolean → 1/0). */
export function flattenMoodleParams(params: MoodleParams, prefix = ''): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(params)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const indexed = Object.fromEntries(value.map((v, i) => [String(i), v] as const));
      out.push(...flattenMoodleParams(indexed, name));
    } else if (typeof value === 'object') {
      out.push(...flattenMoodleParams(value as MoodleParams, name));
    } else if (typeof value === 'boolean') {
      out.push([name, value ? '1' : '0']);
    } else {
      out.push([name, String(value)]);
    }
  }
  return out;
}

function isMoodleException(body: unknown): body is { errorcode?: string; message?: string } {
  return typeof body === 'object' && body !== null && 'exception' in body;
}

export function createMoodleClient(options: MoodleClientOptions): MoodleClient {
  const endpoint = new URL('webservice/rest/server.php', options.baseUrl.replace(/\/?$/, '/'));
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  return {
    async call<T>(wsfunction: string, params: MoodleParams = {}): Promise<T> {
      const body = new URLSearchParams([
        ['wstoken', options.token],
        ['wsfunction', wsfunction],
        ['moodlewsrestformat', 'json'],
        ...flattenMoodleParams(params),
      ]);
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const timedOut = error instanceof Error && error.name === 'TimeoutError';
        throw new MoodleError(
          timedOut ? 'TIMEOUT' : 'NETWORK',
          timedOut
            ? `Moodle không trả lời sau ${timeoutMs / 1000} giây (${wsfunction})`
            : `Không kết nối được Moodle (${wsfunction})`,
        );
      }
      if (!response.ok) {
        throw new MoodleError(
          `HTTP_${response.status}`,
          `Moodle trả HTTP ${response.status} (${wsfunction})`,
        );
      }
      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = text === '' ? null : JSON.parse(text);
      } catch {
        throw new MoodleError('INVALID_JSON', `Moodle trả dữ liệu không phải JSON (${wsfunction})`);
      }
      if (isMoodleException(parsed)) {
        throw new MoodleError(
          parsed.errorcode ?? 'moodle_exception',
          parsed.message ?? 'Lỗi Moodle',
        );
      }
      return parsed as T;
    },
  };
}
