import { NextResponse } from 'next/server';
import { isAuthenticated } from '../../../utils/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authenticated = await isAuthenticated();
  return NextResponse.json({ authenticated });
}
