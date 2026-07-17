export function verifyCronRequest(request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn('[Cron] CRON_SECRET 미설정 — 인증 없이 Cron Route가 열려 있습니다.');
    return process.env.NODE_ENV !== 'production';
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(' ');
  return scheme === 'Bearer' && token === secret;
}
