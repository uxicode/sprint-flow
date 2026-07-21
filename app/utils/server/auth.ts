import { cookies } from 'next/headers';
import crypto from 'crypto';

const AUTH_COOKIE_NAME = 'sprintflow_session';
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'sprintflow123!';

export function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME?.trim() || DEFAULT_USERNAME,
    password: process.env.ADMIN_PASSWORD?.trim() || DEFAULT_PASSWORD,
  };
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || 'sprintflow-super-secret-key-2026';
}

export function createSessionToken(username: string): string {
  const secret = getAuthSecret();
  const timestamp = Date.now();
  const data = `${username}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(`${data}:${hmac}`).toString('base64');
}

export function verifySessionToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;

    const [username, timestampStr, hmac] = parts;
    const { username: adminUsername } = getAdminCredentials();
    if (username !== adminUsername) return false;

    const timestamp = parseInt(timestampStr, 10);
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (isNaN(timestamp) || Date.now() - timestamp > maxAge) return false;

    const secret = getAuthSecret();
    const expectedHmac = crypto.createHmac('sha256', secret).update(`${username}:${timestampStr}`).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch {
    return false;
  }
}

export async function setAuthCookie(username: string): Promise<void> {
  const cookieStore = await cookies();
  const token = createSessionToken(username);
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}
