import { NextResponse } from 'next/server';
import { clearAuthCookie } from '../../../utils/server/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ success: true, message: '로그아웃되었습니다.' });
}
