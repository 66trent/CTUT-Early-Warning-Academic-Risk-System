import { describe, expect, it } from 'vitest';
import {
  createMoodleClient,
  flattenMoodleParams,
  MoodleError,
} from '@/modules/data-import/moodle/client';

function fakeFetch(body: string, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = ((url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(new Response(body, { status }));
  }) as typeof fetch;
  return { impl, calls };
}

describe('Moodle client — mã hóa tham số kiểu PHP', () => {
  it('mảng, đối tượng lồng nhau, boolean, bỏ null/undefined', () => {
    expect(
      flattenMoodleParams({
        assignmentids: [5, 7],
        options: [{ name: 'onlyactive', value: true }],
        field: 'idnumber',
        since: undefined,
        before: null,
      }),
    ).toEqual([
      ['assignmentids[0]', '5'],
      ['assignmentids[1]', '7'],
      ['options[0][name]', 'onlyactive'],
      ['options[0][value]', '1'],
      ['field', 'idnumber'],
    ]);
  });
});

describe('Moodle client — gọi web service', () => {
  it('POST tới /webservice/rest/server.php, token trong thân (không trên URL)', async () => {
    const { impl, calls } = fakeFetch('{"sitename":"moodle-ewars"}');
    const client = createMoodleClient({
      baseUrl: 'http://moodle:80',
      token: 'secret-token',
      fetchImpl: impl,
    });
    const info = await client.call<{ sitename: string }>('core_webservice_get_site_info');
    expect(info.sitename).toBe('moodle-ewars');
    expect(calls[0]?.url).toBe('http://moodle/webservice/rest/server.php');
    expect(calls[0]?.url).not.toContain('secret-token');
    expect(calls[0]?.init.method).toBe('POST');
    const sent = calls[0]?.init.body;
    if (!(sent instanceof URLSearchParams)) throw new Error('body phải là URLSearchParams');
    expect(sent.get('wstoken')).toBe('secret-token');
    expect(sent.get('wsfunction')).toBe('core_webservice_get_site_info');
    expect(sent.get('moodlewsrestformat')).toBe('json');
  });

  it('lỗi Moodle (HTTP 200 + exception) → MoodleError với errorcode', async () => {
    const { impl } = fakeFetch(
      '{"exception":"moodle_exception","errorcode":"invalidtoken","message":"Invalid token"}',
    );
    const client = createMoodleClient({ baseUrl: 'http://moodle/', token: 't', fetchImpl: impl });
    await expect(client.call('core_webservice_get_site_info')).rejects.toMatchObject({
      name: 'MoodleError',
      code: 'invalidtoken',
    });
  });

  it('HTTP lỗi và dữ liệu không phải JSON', async () => {
    const http = createMoodleClient({
      baseUrl: 'http://m',
      token: 't',
      fetchImpl: fakeFetch('', 503).impl,
    });
    await expect(http.call('x')).rejects.toBeInstanceOf(MoodleError);
    await expect(http.call('x')).rejects.toMatchObject({ code: 'HTTP_503' });
    const html = createMoodleClient({
      baseUrl: 'http://m',
      token: 't',
      fetchImpl: fakeFetch('<html>').impl,
    });
    await expect(html.call('x')).rejects.toMatchObject({ code: 'INVALID_JSON' });
  });

  it('không kết nối được → NETWORK', async () => {
    const impl = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    const client = createMoodleClient({ baseUrl: 'http://m', token: 't', fetchImpl: impl });
    await expect(client.call('x')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
