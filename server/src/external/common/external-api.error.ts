/**
 * 외부 API 연동 오류 계층.
 *
 * 설계 원칙:
 * - 원본 오류(응답 본문·URL·헤더) 그대로 노출 금지
 * - API key 등 민감정보가 message·로그에 남지 않게 — 원본은 `cause`에만 보관
 * - 서비스·미들웨어가 `instanceof`로 상황별 처리 가능하게
 */

export interface ExternalApiErrorOptions {
  /** 클라이언트 분기용 코드. 미지정 시 클래스별 기본값. */
  code?: string;
  /** 외부 API가 반환한 HTTP 상태 코드(있으면). */
  status?: number;
  /** 디버깅용 원본 오류. 로그에 남길 때 민감정보 확인 필수. */
  cause?: unknown;
}

export class ExternalApiError extends Error {
  /** 발생 서비스('tour' | 'congestion' | 'tmap' | 'prediction'). */
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
      // 원본은 Error.cause에만 — message 합성 금지(민감정보 유출 방지)
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** 응답 timeout 초과. */
export class ExternalApiTimeoutError extends ExternalApiError {
  constructor(service: string, options: Omit<ExternalApiErrorOptions, 'code' | 'status'> = {}) {
    super(service, `Request to "${service}" timed out`, { ...options, code: 'TIMEOUT' });
    this.name = 'ExternalApiTimeoutError';
  }
}

/** 인증 실패(401/403) — API key 오류 등. */
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
 * 외부 API가 "해당 리소스 데이터 없음"을 알린 경우.
 *
 * 연동 장애가 아닌 정상 "없음" → 502가 아니라 404
 * (SK 퍼즐이 커버하지 않는 POI 등). "재시도할 일시 오류"와 "원래 없는 데이터"를
 * 클라이언트가 구분해야 해서 별도 계층.
 */
export class ExternalApiNotFoundError extends ExternalApiError {
  constructor(
    service: string,
    message: string,
    options: ExternalApiErrorOptions = {},
  ) {
    super(service, message, { ...options, code: options.code ?? 'NOT_FOUND' });
    this.name = 'ExternalApiNotFoundError';
  }
}

/**
 * 예상 밖 응답(4xx/5xx, 파싱 실패, 필수 필드 누락 등).
 * 원인은 message에, 원본 응답 본문은 미포함.
 */
export class ExternalApiResponseError extends ExternalApiError {
  constructor(service: string, message: string, options: Omit<ExternalApiErrorOptions, 'code'> = {}) {
    super(service, message, { ...options, code: 'INVALID_RESPONSE' });
    this.name = 'ExternalApiResponseError';
  }
}
