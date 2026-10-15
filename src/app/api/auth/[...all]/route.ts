import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Endpoint của Better Auth (docs/rules/01). Khởi tạo lười để `next build` không cần secret. */
export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}
