import { NextResponse } from 'next/server';
import { verifyCronRequest } from '../../../utils/server/cronAuth';
import { runDailyReportJob } from '../../../utils/server/dailyReportJob';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function handleCron(request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Authorization: Bearer CRON_SECRET 헤더가 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const result = await runDailyReportJob();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron daily-report] 실패:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return handleCron(request);
}

export async function POST(request) {
  return handleCron(request);
}
