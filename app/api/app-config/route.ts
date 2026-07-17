import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '../../utils/server/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getAppConfig();

  return NextResponse.json({
    ...config,
    configured: config.hasJiraCredentials || config.hasCalendarCredentials,
  });
}
