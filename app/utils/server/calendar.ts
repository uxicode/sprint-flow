import type {
  CalendarEvent,
  ServerCalendarFetchParams,
  ServerCalendarFetchResult,
} from '../../types';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleCalendarEventsResponse {
  items?: CalendarEvent[];
}

interface HttpStatusError extends Error {
  status?: number;
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Google 토큰 갱신 실패 (${response.status}): ${await response.text()}`);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

async function fetchEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errText = await response.text();
    const error: HttpStatusError = new Error(`Calendar API HTTP ${response.status}: ${errText}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json() as GoogleCalendarEventsResponse;
  return data.items || [];
}

function getHttpStatus(err: unknown): number | undefined {
  if (err instanceof Error && 'status' in err) {
    return (err as HttpStatusError).status;
  }
  return undefined;
}

export async function fetchCalendarEventsServer({
  calendarId,
  start,
  end,
  accessToken,
  refreshToken,
  clientId,
  clientSecret,
}: ServerCalendarFetchParams): Promise<ServerCalendarFetchResult> {
  if (!calendarId) {
    return { items: [], skipped: true };
  }

  if (!accessToken && !refreshToken) {
    console.warn('[Cron Calendar] 토큰 없음 — 캘린더 조회 스킵');
    return { items: [], skipped: true };
  }

  const timeMin = `${start}T00:00:00.000Z`;
  const timeMax = `${end}T23:59:59.999Z`;

  let currentAccessToken = accessToken;

  if (!currentAccessToken && refreshToken && clientId && clientSecret) {
    const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
    currentAccessToken = refreshed.access_token;
  }

  if (!currentAccessToken) {
    return { items: [], skipped: true, error: 'access token 없음' };
  }

  try {
    const items = await fetchEvents(currentAccessToken, calendarId, timeMin, timeMax);
    return { items, skipped: false, newAccessToken: currentAccessToken !== accessToken ? currentAccessToken : null };
  } catch (err: unknown) {
    if (getHttpStatus(err) === 401 && refreshToken && clientId && clientSecret) {
      const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
      const items = await fetchEvents(refreshed.access_token, calendarId, timeMin, timeMax);
      return { items, skipped: false, newAccessToken: refreshed.access_token };
    }
    throw err;
  }
}
