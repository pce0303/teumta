import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * 최소 관리자 인증용 무상태 토큰(HMAC-SHA256).
 *
 * - 세션 저장소/DB 없이 서명으로 검증한다.
 * - 서명 키는 ADMIN_PASSWORD에서 유도한다 → 비밀번호를 바꾸면 기존 토큰이 전부 무효화된다.
 * - 토큰 형식: "<만료시각 epoch ms>.<base64url HMAC>"
 * - 클라이언트 번들에는 어떤 secret도 넣지 않는다(비밀번호는 서버 env에만 존재).
 */

const KEY_CONTEXT = 'teumta-admin-token';

export const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function deriveSigningKey(adminPassword: string): Buffer {
  return createHash('sha256')
    .update(`${KEY_CONTEXT}:${adminPassword}`)
    .digest();
}

function signPayload(payload: string, adminPassword: string): Buffer {
  return createHmac('sha256', deriveSigningKey(adminPassword))
    .update(payload)
    .digest();
}

/** 비밀번호 비교(타이밍 안전). 길이 노출을 막기 위해 해시 후 비교한다. */
export function verifyAdminPassword(
  input: string,
  configuredPassword: string,
): boolean {
  if (configuredPassword.length === 0) {
    return false;
  }
  const inputDigest = createHash('sha256').update(input).digest();
  const configuredDigest = createHash('sha256')
    .update(configuredPassword)
    .digest();
  return timingSafeEqual(inputDigest, configuredDigest);
}

export interface IssuedAdminToken {
  token: string;
  /** ISO 8601 만료 시각(클라이언트 만료 처리용). */
  expiresAt: string;
}

export function issueAdminToken(
  adminPassword: string,
  now: number = Date.now(),
  ttlMs: number = ADMIN_TOKEN_TTL_MS,
): IssuedAdminToken {
  const expiresAtMs = now + ttlMs;
  const payload = String(expiresAtMs);
  const signature = signPayload(payload, adminPassword).toString('base64url');

  return {
    token: `${payload}.${signature}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function verifyAdminToken(
  token: string,
  adminPassword: string,
  now: number = Date.now(),
): boolean {
  if (adminPassword.length === 0) {
    return false;
  }

  const separatorIndex = token.indexOf('.');
  if (separatorIndex <= 0) {
    return false;
  }

  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!/^\d+$/.test(payload) || signature.length === 0) {
    return false;
  }

  const expected = signPayload(payload, adminPassword);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return false;
  }

  return Number(payload) > now;
}
