import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Context } from 'hono';
import { db } from '../db/db.js';

const scrypt = promisify(scryptCallback);
const sessionCookieName = 'archive_session';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function readToken(c: Context) {
  const cookie = c.req.header('Cookie') ?? '';
  return cookie.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1);
}

// this is specifically for passwords
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [saltHex, keyHex] = storedHash.split(':');
  if (!saltHex || !keyHex) {
    return false;
  }
  const derivedKey = await scrypt(password, Buffer.from(saltHex, 'hex'), 64) as Buffer;
  const expectedKey = Buffer.from(keyHex, 'hex');
  return derivedKey.length === expectedKey.length && timingSafeEqual(derivedKey, expectedKey);
}

export async function getSession(c: Context) {
  const token = readToken(c);
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const session = await db
    .selectFrom('user_cookies')
    .innerJoin('users', 'users.user_id', 'user_cookies.user_id')
    .select([
      'user_cookies.user_id',
      'user_cookies.expires_at',
      'users.username',
      'users.is_locked',
    ])
    .where('user_cookies.token_hash', '=', tokenHash)
    .where('user_cookies.expires_at', '>', new Date())
    .executeTakeFirst();

  if (!session || session.is_locked) {
    await db.deleteFrom('user_cookies').where('token_hash', '=', tokenHash).execute();
    return null;
  }

  return {
    token,
    userId: session.user_id,
    username: session.username,
    expiresAt: session.expires_at.getTime(),
  };
}

export async function setSessionCookie(c: Context, userId: number) {

  const token = randomBytes(64).toString('base64url');
  const expiresAt = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000));

  await db.insertInto('user_cookies').values({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  }).execute();

  c.header(
    'Set-Cookie',
    `${sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${(14 * 24 * 60 * 60 * 1000) / 1000}`,
  );
}

export async function clearSession(c: Context) {

  const token = readToken(c);
  if (token) {
    await db.deleteFrom('user_cookies').where('token_hash', '=', hashToken(token)).execute();
  }

  c.header('Set-Cookie', `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}
