import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * 관리자 인증 미들웨어/로그인 컨트롤러 테스트.
 * env는 mock — 실제 .env에 의존하지 않는다.
 */

const envMock = vi.hoisted(() => ({
  env: {
    ADMIN_PASSWORD: 'test-admin-password',
  },
}));

vi.mock('../config/env', () => envMock);

import { adminLoginController } from '../controllers/admin-auth.controller';
import { issueAdminToken } from '../utils/admin-token';
import { adminAuthMiddleware } from './admin-auth.middleware';
import { resetLoginRateLimit } from './login-rate-limit.middleware';

interface FakeResponse {
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeResponse;
  json: (payload: unknown) => FakeResponse;
}

function makeRes(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 0,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    ...overrides,
  } as Request;
}

beforeEach(() => {
  envMock.env.ADMIN_PASSWORD = 'test-admin-password';
  resetLoginRateLimit();
});

describe('adminAuthMiddleware', () => {
  it('유효한 Bearer 토큰이면 next를 호출한다', () => {
    const { token } = issueAdminToken(envMock.env.ADMIN_PASSWORD);
    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
    } as Partial<Request>);
    const res = makeRes();
    const next = vi.fn();

    adminAuthMiddleware(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('토큰이 없으면 401 UNAUTHORIZED', () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    adminAuthMiddleware(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('잘못된 토큰이면 401', () => {
    const req = makeReq({
      headers: { authorization: 'Bearer invalid-token' },
    } as Partial<Request>);
    const res = makeRes();
    const next = vi.fn();

    adminAuthMiddleware(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('ADMIN_PASSWORD 미설정이면 503 (fail closed)', () => {
    envMock.env.ADMIN_PASSWORD = '';
    const { token } = issueAdminToken('whatever');
    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
    } as Partial<Request>);
    const res = makeRes();
    const next = vi.fn();

    adminAuthMiddleware(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      error: { code: 'ADMIN_AUTH_NOT_CONFIGURED' },
    });
  });
});

describe('adminLoginController', () => {
  it('올바른 비밀번호면 토큰을 발급한다', () => {
    const req = makeReq({ body: { password: 'test-admin-password' } });
    const res = makeRes();
    const next = vi.fn();

    adminLoginController(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      success: boolean;
      data: { token: string; expiresAt: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.token).toContain('.');
    expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('틀린 비밀번호면 401 INVALID_CREDENTIALS', () => {
    const req = makeReq({ body: { password: 'wrong' } });
    const res = makeRes();
    const next = vi.fn();

    adminLoginController(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      error: { code: 'INVALID_CREDENTIALS' },
    });
  });

  it('password 누락이면 400', () => {
    const req = makeReq({ body: {} });
    const res = makeRes();
    const next = vi.fn();

    adminLoginController(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(400);
  });

  it('ADMIN_PASSWORD 미설정이면 503', () => {
    envMock.env.ADMIN_PASSWORD = '';
    const req = makeReq({ body: { password: 'anything' } });
    const res = makeRes();
    const next = vi.fn();

    adminLoginController(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      error: { code: 'ADMIN_AUTH_NOT_CONFIGURED' },
    });
  });
});
