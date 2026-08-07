import { describe, expect, it } from 'vitest';

import {
  ADMIN_TOKEN_TTL_MS,
  issueAdminToken,
  verifyAdminPassword,
  verifyAdminToken,
} from './admin-token';

const PASSWORD = 'test-admin-password';

describe('verifyAdminPassword', () => {
  it('일치하는 비밀번호를 통과시킨다', () => {
    expect(verifyAdminPassword(PASSWORD, PASSWORD)).toBe(true);
  });

  it('불일치/빈 설정을 거부한다', () => {
    expect(verifyAdminPassword('wrong', PASSWORD)).toBe(false);
    expect(verifyAdminPassword('', PASSWORD)).toBe(false);
    // 설정 비밀번호가 비어 있으면 어떤 입력도 통과할 수 없다(fail closed).
    expect(verifyAdminPassword('', '')).toBe(false);
    expect(verifyAdminPassword('anything', '')).toBe(false);
  });
});

describe('issueAdminToken / verifyAdminToken', () => {
  it('발급한 토큰은 만료 전까지 유효하다', () => {
    const now = 1_700_000_000_000;
    const issued = issueAdminToken(PASSWORD, now);

    expect(verifyAdminToken(issued.token, PASSWORD, now)).toBe(true);
    expect(
      verifyAdminToken(issued.token, PASSWORD, now + ADMIN_TOKEN_TTL_MS - 1),
    ).toBe(true);
    expect(issued.expiresAt).toBe(
      new Date(now + ADMIN_TOKEN_TTL_MS).toISOString(),
    );
  });

  it('만료된 토큰을 거부한다', () => {
    const now = 1_700_000_000_000;
    const issued = issueAdminToken(PASSWORD, now);

    expect(
      verifyAdminToken(issued.token, PASSWORD, now + ADMIN_TOKEN_TTL_MS),
    ).toBe(false);
  });

  it('다른 비밀번호로 서명된 토큰을 거부한다(비밀번호 변경 시 전체 무효화)', () => {
    const issued = issueAdminToken(PASSWORD);
    expect(verifyAdminToken(issued.token, 'changed-password')).toBe(false);
  });

  it('형식이 깨진 토큰을 거부한다', () => {
    expect(verifyAdminToken('', PASSWORD)).toBe(false);
    expect(verifyAdminToken('garbage', PASSWORD)).toBe(false);
    expect(verifyAdminToken('.sig-only', PASSWORD)).toBe(false);
    expect(verifyAdminToken('12345.', PASSWORD)).toBe(false);
    expect(verifyAdminToken('notanumber.abc', PASSWORD)).toBe(false);

    const issued = issueAdminToken(PASSWORD);
    const [payload] = issued.token.split('.');
    expect(verifyAdminToken(`${payload}.tampered`, PASSWORD)).toBe(false);
  });

  it('만료 시각(payload)을 위조하면 서명 검증에서 거부된다', () => {
    const now = 1_700_000_000_000;
    const issued = issueAdminToken(PASSWORD, now);
    const [, signature] = issued.token.split('.');
    const forged = `${now + 999_999_999}.${signature}`;

    expect(verifyAdminToken(forged, PASSWORD, now)).toBe(false);
  });

  it('설정 비밀번호가 비어 있으면 모든 토큰을 거부한다', () => {
    const issued = issueAdminToken(PASSWORD);
    expect(verifyAdminToken(issued.token, '')).toBe(false);
  });
});
