import { externalConfig } from './external.config';
import {
  ExternalApiAuthError,
  ExternalApiError,
  ExternalApiRateLimitError,
  ExternalApiResponseError,
  ExternalApiTimeoutError,
} from './external-api.error';

/**
 * 모든 외부 API 클라이언트가 공유하는 fetch 래퍼.
 *
 * 책임:
 * - timeout(AbortController) 적용
 * - HTTP 상태 코드를 ExternalApiError 계층으로 분류
 * - JSON 파싱 실패 처리
 *
 * 주의:
 * - 에러 message에 URL/헤더/응답 본문을 넣지 않는다(API key 등 민감정보 유출 방지).
 * - Node 22의 global fetch를 사용한다(별도 HTTP 라이브러리 추가 없음).
 */

export interface RequestJsonOptions {
  /** 로깅/에러 분류용 서비스 식별자. */
  service: string;
  /** 완성된 요청 URL(쿼리 포함). key가 쿼리에 포함될 수 있으므로 에러 message에는 넣지 않는다. */
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  /** 있으면 JSON 직렬화하여 전송한다. */
  body?: unknown;
  /** 미지정 시 externalConfig.timeoutMs 사용. */
  timeoutMs?: number;
}

export async function requestJson<T = unknown>(options: RequestJsonOptions): Promise<T> {
  const { service, url, method = 'GET', headers, body } = options;
  const timeoutMs = options.timeoutMs ?? externalConfig.timeoutMs;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExternalApiTimeoutError(service, { cause: error });
    }
    // 네트워크 오류 등. 원본 메시지에 민감정보가 있을 수 있어 그대로 노출하지 않는다.
    throw new ExternalApiError(service, `Request to "${service}" failed`, {
      code: 'NETWORK_ERROR',
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw classifyHttpError(service, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ExternalApiResponseError(service, 'Failed to parse response body as JSON', {
      status: response.status,
      cause: error,
    });
  }
}

/** HTTP 상태 코드를 상황별 ExternalApiError로 분류한다. */
function classifyHttpError(service: string, status: number): ExternalApiError {
  if (status === 401 || status === 403) {
    return new ExternalApiAuthError(service, { status });
  }
  if (status === 429) {
    return new ExternalApiRateLimitError(service, { status });
  }
  return new ExternalApiResponseError(service, `Unexpected response status ${status}`, { status });
}
