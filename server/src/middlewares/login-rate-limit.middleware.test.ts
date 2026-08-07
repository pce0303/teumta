import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

import {
  LOGIN_RATE_MAX_FAILURES,
  LOGIN_RATE_WINDOW_MS,
  loginRateLimitMiddleware,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginRateLimit,
} from './login-rate-limit.middleware';

interface FakeResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status: (code: number) => FakeResponse;
  json: (payload: unknown) => FakeResponse;
  set: (name: string, value: string) => FakeResponse;
}

function makeRes(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 0,
    body: null,
    headers: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    set(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
  };
  return res;
}

function makeReq(ip = '1.2.3.4'): Request {
  return { ip } as Request;
}

beforeEach(() => {
  resetLoginRateLimit();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-07T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loginRateLimitMiddleware', () => {
  it('한도 미만이면 통과시킨다', () => {
    const req = makeReq();
    for (let i = 0; i < LOGIN_RATE_MAX_FAILURES - 1; i += 1) {
      recordLoginFailure(req, Date.now());
    }
    const res = makeRes();
    const next = vi.fn();

    loginRateLimitMiddleware(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('실패 한도 도달 시 429 + Retry-After를 반환한다', () => {
    const req = makeReq();
    for (let i = 0; i < LOGIN_RATE_MAX_FAILURES; i += 1) {
      recordLoginFailure(req, Date.now());
    }
    const res = makeRes();
    const next = vi.fn();

    loginRateLimitMiddleware(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'TOO_MANY_ATTEMPTS' },
    });
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('다른 IP는 영향받지 않는다', () => {
    const blocked = makeReq('1.1.1.1');
    for (let i = 0; i < LOGIN_RATE_MAX_FAILURES; i += 1) {
      recordLoginFailure(blocked, Date.now());
    }
    const res = makeRes();
    const next = vi.fn();

    loginRateLimitMiddleware(makeReq('2.2.2.2'), res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('로그인 성공 시 실패 기록이 초기화된다', () => {
    const req = makeReq();
    for (let i = 0; i < LOGIN_RATE_MAX_FAILURES; i += 1) {
      recordLoginFailure(req, Date.now());
    }
    recordLoginSuccess(req);

    const res = makeRes();
    const next = vi.fn();
    loginRateLimitMiddleware(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('시간 창이 지나면 다시 허용된다', () => {
    const req = makeReq();
    for (let i = 0; i < LOGIN_RATE_MAX_FAILURES; i += 1) {
      recordLoginFailure(req, Date.now());
    }
    vi.advanceTimersByTime(LOGIN_RATE_WINDOW_MS + 1000);

    const res = makeRes();
    const next = vi.fn();
    loginRateLimitMiddleware(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
