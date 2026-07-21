import { NextRequest, NextResponse } from 'next/server';
import { getAdminCredentials, setAuthCookie } from '../../../utils/server/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json(
        { success: false, error: '아이디와 비밀번호를 모두 입력해 주세요.' },
        { status: 400 }
      );
    }

    const credentials = getAdminCredentials();

    if (username.trim() !== credentials.username || password.trim() !== credentials.password) {
      return NextResponse.json(
        { success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    await setAuthCookie(credentials.username);

    return NextResponse.json({
      success: true,
      message: '로그인되었습니다.',
    });
  } catch (error) {
    console.error('[Auth Login] 에러:', error);
    return NextResponse.json(
      { success: false, error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
