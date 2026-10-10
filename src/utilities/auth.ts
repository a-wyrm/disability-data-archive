import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Context } from 'hono';

const scrypt = promisify(scryptCallback);
const sessions = new Map<string, { userId: number; username: string; expiresAt: number }>();
const sessionMaxAge = 8 * 60 * 60 * 1000;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [saltHex, keyHex] = storedHash.split(':');
  if (!saltHex || !keyHex) return false;
  const derivedKey = await scrypt(password, Buffer.from(saltHex, 'hex'), 64) as Buffer;
  const expectedKey = Buffer.from(keyHex, 'hex');
  return derivedKey.length === expectedKey.length && timingSafeEqual(derivedKey, expectedKey);
}

export function createSession(userId: number, username: string) {
  const token = randomUUID();
  sessions.set(token, { userId, username, expiresAt: Date.now() + sessionMaxAge });
  return token;
}

export function getSession(c: Context) {
  const cookie = c.req.header('Cookie') ?? '';
  const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('archive_session='))?.slice('archive_session='.length);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

export function setSessionCookie(c: Context, token: string) {
  c.header('Set-Cookie', `archive_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionMaxAge / 1000}`);
}

export function clearSession(c: Context) {
  const session = getSession(c);
  if (session) sessions.delete(session.token);
  c.header('Set-Cookie', 'archive_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}