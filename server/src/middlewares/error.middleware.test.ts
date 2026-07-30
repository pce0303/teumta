import { describe, expect, it } from 'vitest';

import {
  ExternalApiAuthError,
  ExternalApiError,
  ExternalApiRateLimitError,
  ExternalApiResponseError,
  ExternalApiTimeoutError,
} from '../external/common/external-api.error';
import { resolveErrorResponse } from './error.middleware';

describe('resolveErrorResponse', () => {
  it('일반 Error는 500 INTERNAL_ERROR', () => {
    expect(resolveErrorResponse(new Error('boom'))).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'boom',
    });
  });

  it('timeout은 504', () => {
    expect(resolveErrorResponse(new ExternalApiTimeoutError('tour')).status).toBe(504);
  });

  it('rate limit은 503', () => {
    expect(resolveErrorResponse(new ExternalApiRateLimitError('tour')).status).toBe(503);
  });

  it('auth 실패는 502', () => {
    expect(resolveErrorResponse(new ExternalApiAuthError('tour')).status).toBe(502);
  });

  it('잘못된 응답은 502', () => {
    expect(resolveErrorResponse(new ExternalApiResponseError('tour', 'bad')).status).toBe(502);
  });

  it('설정 누락(CONFIG_MISSING)은 우리 측 오류이므로 500', () => {
    const error = new ExternalApiError('tour', 'no key', { code: 'CONFIG_MISSING' });
    expect(resolveErrorResponse(error).status).toBe(500);
  });

  it('code를 응답에 전달한다', () => {
    expect(resolveErrorResponse(new ExternalApiRateLimitError('tour')).code).toBe('RATE_LIMITED');
  });
});
