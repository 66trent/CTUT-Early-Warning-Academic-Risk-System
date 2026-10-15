import { NextResponse } from 'next/server';
import { getHealthReport } from '@/modules/admin/services/health.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const report = await getHealthReport();
  return NextResponse.json(report, { status: report.status === 'ok' ? 200 : 503 });
}
