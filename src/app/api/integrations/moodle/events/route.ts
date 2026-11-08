import { NextResponse } from 'next/server';
import { MAX_EVENT_BYTES } from '@/modules/data-import/moodle/webhook';
import { handleMoodleEventRequest } from '@/modules/data-import/services/moodle-event.service';

export const dynamic = 'force-dynamic';

/**
 * Sự kiện từ plugin Moodle `local_ewars` (Phase 10c — docs/rules/01 cho phép Route Handler gọi bởi
 * hệ thống ngoài). Không dùng phiên đăng nhập: xác thực bằng chữ ký HMAC + dấu thời gian.
 */
export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_EVENT_BYTES) {
    return NextResponse.json({ ok: false, code: 'TOO_LARGE' }, { status: 413 });
  }
  const result = await handleMoodleEventRequest({
    body: await request.text(),
    headers: request.headers,
    now: new Date(),
  });
  return NextResponse.json(result.body, { status: result.status });
}
