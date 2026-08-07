import type { Request, RequestHandler } from 'express';

/**
 * 로그인 무차별 대입 방지(최소 구현, 외부 의존성 없음).
 *
 * - IP별 실패 횟수를 in-memory로 집계: 15분 창에서 실패 10회 초과 시 429.
 * - 로그인 성공 시 해당 IP 기록을 즉시 초기화한다.
 * - 프로세스 재시작 시 초기화됨(단일 인스턴스 전제 — 현재 배포 구조와 일치).
 * - req.ip가 프록시 뒤에서 실제 클라이언트를 가리키도록 app.ts에서 trust proxy 설정.
 */

export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_MAX_FAILURES = 10;

/** Map 무한 증식 방지용 정리 임계값. */
const SWEEP_THRESHOLD = 1000;

interface FailureEntry {
  failures: number;
  windowStartedAt: number;
}

const failureEntries = new Map<string, FailureEntry>();

function clientKey(req: Request): string {
  return req.ip ?? 'unknown';
}

function sweepExpired(now: number) {
  for (const [key, entry] of failureEntries) {
    if (now - entry.windowStartedAt >= LOGIN_RATE_WINDOW_MS) {
      failureEntries.delete(key);
    }
  }
}

export const loginRateLimitMiddleware: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const key = clientKey(req);

  const entry = failureEntries.get(key);
  if (entry && now - entry.windowStartedAt >= LOGIN_RATE_WINDOW_MS) {
    failureEntries.delete(key);
  }

  const active = failureEntries.get(key);
  if (active && active.failures >= LOGIN_RATE_MAX_FAILURES) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((active.windowStartedAt + LOGIN_RATE_WINDOW_MS - now) / 1000),
    );
    res.set('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      success: false,
      data: null,
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: `로그인 시도가 너무 많습니다. ${Math.ceil(retryAfterSeconds / 60)}분 후 다시 시도하세요.`,
      },
    });
    return;
  }

  next();
};

/** 로그인 실패 시 컨트롤러가 호출한다. */
export function recordLoginFailure(req: Request, now: number = Date.now()) {
  if (failureEntries.size >= SWEEP_THRESHOLD) {
    sweepExpired(now);
  }

  const key = clientKey(req);
  const entry = failureEntries.get(key);

  if (!entry || now - entry.windowStartedAt >= LOGIN_RATE_WINDOW_MS) {
    failureEntries.set(key, { failures: 1, windowStartedAt: now });
    return;
  }
  entry.failures += 1;
}

/** 로그인 성공 시 해당 IP 기록 초기화. */
export function recordLoginSuccess(req: Request) {
  failureEntries.delete(clientKey(req));
}

/** 테스트 전용: 전체 상태 초기화. */
export function resetLoginRateLimit() {
  failureEntries.clear();
}
