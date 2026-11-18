import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from '@/lib/db/database';

export const SESSION_COOKIE_NAME = 'jurivexora_session';

declare global {
  var _jurivexoraJwtSecret: Uint8Array | undefined;
}

function getSecret(): Uint8Array {
  if (global._jurivexoraJwtSecret) return global._jurivexoraJwtSecret;
  const envSecret = process.env.SESSION_SECRET;
  const raw =
    envSecret && envSecret !== 'REPLACE_WITH_SECURE_RANDOM_HEX'
      ? envSecret
      : 'jurivexora-academic-rd-session-key-bangladesh-2026';
  global._jurivexoraJwtSecret = new TextEncoder().encode(raw);
  return global._jurivexoraJwtSecret;
}

export interface SessionPayload {
  userId: number;
  email: string;
  jti: string;
}

export async function createUserSession(params: {
  userId: number;
  email: string;
  mfaVerified: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ token: string; jti: string; expiresAt: string }> {
  const db = getDb();
  const jti = crypto.randomUUID();
  const expiresDate = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
  const expiresAt = expiresDate.toISOString();

  db.prepare(
    `INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, mfa_verified, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    params.userId,
    jti,
    params.ipAddress || '127.0.0.1',
    params.userAgent || 'Web Client',
    params.mfaVerified ? 1 : 0,
    expiresAt
  );

  const token = await new SignJWT({
    userId: params.userId,
    email: params.email,
    jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret());

  return { token, jti, expiresAt };
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId === 'number' &&
      typeof payload.email === 'string' &&
      typeof payload.jti === 'string'
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        jti: payload.jti,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
