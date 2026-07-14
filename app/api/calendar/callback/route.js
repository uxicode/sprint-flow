import { NextResponse } from 'next/server';

/**
 * Google Calendar OAuth 2.0 콜백 API
 * 
 * GET /api/calendar/callback?code=...&state=...
 * 
 * Google에서 리디렉트된 authorization code를 받아
 * access_token + refresh_token으로 교환한 뒤,
 * 클라이언트(메인 페이지)로 결과를 전달합니다.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateBase64 = searchParams.get('state');
  const error = searchParams.get('error');

  // 사용자가 동의를 거부한 경우
  if (error) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('calendar_auth', 'denied');
    redirectUrl.searchParams.set('calendar_error', error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('calendar_auth', 'error');
    redirectUrl.searchParams.set('calendar_error', 'authorization code가 없습니다.');
    return NextResponse.redirect(redirectUrl);
  }

  // state에서 calendarId 복구 (선택)
  let calendarId = '';
  if (stateBase64) {
    try {
      const stateJson = Buffer.from(stateBase64, 'base64').toString('utf-8');
      const stateObj = JSON.parse(stateJson);
      calendarId = stateObj.calendarId || '';
    } catch (e) {
      console.warn('[Calendar Callback] state 파싱 실패:', e);
    }
  }

  // 클라이언트로 code를 전달 — 토큰 교환은 /api/calendar/token에서 수행
  // (client_secret을 query param으로 노출하지 않기 위해 2단계로 분리)
  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('calendar_auth', 'success');
  redirectUrl.searchParams.set('calendar_code', code);
  if (calendarId) {
    redirectUrl.searchParams.set('calendar_id', calendarId);
  }

  return NextResponse.redirect(redirectUrl);
}
