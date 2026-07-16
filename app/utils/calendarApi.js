/**
 * 캘린더 이벤트 조회 함수
 * @param {string} calId - 캘린더 ID
 * @param {string} start - 시작일
 * @param {string} end - 종료일
 * @param {string} accessToken - 액세스 토큰
 * @param {string} refreshToken - 리프레시 토큰
 * @param {string} clientId - 클라이언트 ID
 * @param {string} clientSecret - 클라이언트 시크릿
 */
export async function fetchCalendarEvents({ calId, start, end, accessToken, refreshToken, clientId, clientSecret }) {
  const timeMin = `${start}T00:00:00.000Z`;
  const timeMax = `${end}T23:59:59.000Z`;

  if (!calId) return { items: [], error: null, needReauth: false, newAccessToken: null };

  if (!accessToken && !refreshToken) {
    console.warn('[Calendar OAuth] Access Token 또는 Refresh Token이 없습니다.');
    return { items: [], error: null, needReauth: false, newAccessToken: null };
  }

  try {
    console.log('[Calendar OAuth] 이벤트 조회 중...');
    const response = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'events',
        accessToken,
        refreshToken,
        clientId,
        clientSecret,
        calendarId: calId,
        timeMin,
        timeMax,
      }),
    });

    if (!response.ok) {
      let errData = {};
      try {
        errData = await response.json();
      } catch (_) {
        /* ignore */
      }
      const errMsg = errData.error || `Calendar API 오류 (HTTP ${response.status})`;
      return {
        items: [],
        error: errMsg,
        needReauth: !!errData.needReauth,
        newAccessToken: null,
      };
    }

    const data = await response.json();
    console.log(`[Calendar OAuth] ${(data.items || []).length}건 이벤트 로드 완료`);
    return {
      items: data.items || [],
      error: null,
      needReauth: false,
      newAccessToken: data.newAccessToken || null,
    };
  } catch (e) {
    console.warn('캘린더 OAuth 연차 로드 에러 (무시하고 계속 진행):', e.message);
    return { items: [], error: e.message, needReauth: false, newAccessToken: null };
  }
}
