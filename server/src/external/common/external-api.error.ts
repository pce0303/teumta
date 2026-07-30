/**
 * 외부 API 연동에서 발생하는 오류 계층.
 *
 * 설계 원칙:
 * - 외부 API의 원본 오류(응답 본문, URL, 헤더 등)를 그대로 노출하지 않는다.
 * - API key 등 민감정보가 message/로그에 남지 않도록 한다.
 *   (원본 오류는 `cause`에 보관만 하고, message에는 합치지 않는다.)
 * - 서비스/미들웨어가 `instanceof`로 상황별 처리를 할 수 있게 한다.
 */

export interface ExternalApiErrorOptions {
  /** 클라이언트 분기용 코드. 지정하지 않으면 클래스별 기본값을 사용한다. */
  code?: string;
  /** 외부 API가 반환한 HTTP 상태 코드(있는 경우). */
  status?: number;
  /** 디버깅용 원본 오류. 로그에 남길 때는 민감정보 여부를 확인한다. */
  cause?: unknown;
}

export class ExternalApiError extends Error {
  /** 어떤 외부 서비스에서 발생했는지 ('tour' | 'congestion' | 'tmap' | 'prediction'). */
  readonly service: string;
  readonly code: string;
  readonly status?: number;

  constructor(service: string, message: string, options: ExternalApiErrorOptions = {}) {
    super(message);
    this.name = 'ExternalApiError';
    this.service = service;
    this.code = options.code ?? 'EXTERNAL_API_ERROR';
    this.status = options.status;

    if (options.cause !== undefined) {
      // Error.cause에 원본만 보관한다. message에는 절대 합치지 않는다(민감정보 유출 방지).
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** 외부 API 응답이 timeout 시간을 초과한 경우. */
export class ExternalApiTimeoutError extends ExternalApiError {
  constructor(service: string, options: Omit<ExternalApiErrorOptions, 'code' | 'status'> = {}) {
    super(service, `Request to "${service}" timed out`, { ...options, code: 'TIMEOUT' });
    this.name = 'ExternalApiTimeoutError';
  }
}

/** 인증 실패(401/403). API key 오류 등. */
export class ExternalApiAuthError extends ExternalApiError {
  constructor(service: string, options: Omit<ExternalApiErrorOptions, 'code'> = {}) {
    super(service, `Authentication failed for "${service}"`, { ...options, code: 'AUTH_FAILED' });
    this.name = 'ExternalApiAuthError';
  }
}

/** 호출 한도 초과(429). */
export class ExternalApiRateLimitError extends ExternalApiError {
  constructor(service: string, options: Omit<ExternalApiErrorOptions, 'code'> = {}) {
    super(service, `Rate limit exceeded for "${service}"`, { ...options, code: 'RATE_LIMITED' });
    this.name = 'ExternalApiRateLimitError';
  }
}

/**
 * 예상하지 못한 응답(4xx/5xx, 파싱 실패, 필수 필드 누락 등).
 * 구체적인 원인은 message에 담되, 원본 응답 본문은 담지 않는다.
 */
export class ExternalApiResponseError extends ExternalApiError {
  constructor(service: string, message: string, options: Omit<ExternalApiErrorOptions, 'code'> = {}) {
    super(service, message, { ...options, code: 'INVALID_RESPONSE' });
    this.name = 'ExternalApiResponseError';
  }
}
