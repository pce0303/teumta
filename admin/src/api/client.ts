import type { ApiResponse } from '../types/api';
import { clearToken, getStoredToken } from '../utils/auth';

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;

  constructor(
    message: string,
    options: { status?: number | null; code?: string | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '알 수 없는 오류가 발생했습니다.';
}

function resolveBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

  if (typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    throw new ApiError(
      'VITE_API_BASE_URL이 설정되지 않았습니다. admin/.env.example을 복사해 admin/.env를 만드세요.',
    );
  }

  return baseUrl.trim().replace(/\/+$/, '');
}

/**
 * 서버 공통 envelope({ success, data, error })를 해석해 data만 반환한다.
 * 실패 시 서버 error.message를 담은 ApiError를 던진다. mock fallback은 없다.
 */
export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${resolveBaseUrl()}${path}`;
  const token = getStoredToken();

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      '서버에 연결할 수 없습니다. 네트워크 상태와 VITE_API_BASE_URL을 확인하세요.',
    );
  }

  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      `서버 응답을 해석할 수 없습니다. (HTTP ${response.status})`,
      { status: response.status },
    );
  }

  if (!response.ok || !body.success) {
    const errorBody = body.success ? null : body.error;

    // 토큰 만료/무효 → 저장된 토큰 정리(RequireAuth가 로그인 화면으로 보낸다).
    // 로그인 실패(INVALID_CREDENTIALS)는 화면에서 그대로 보여줘야 하므로 제외.
    if (response.status === 401 && path !== '/admin/login') {
      clearToken();
    }

    throw new ApiError(
      errorBody?.message ?? `요청이 실패했습니다. (HTTP ${response.status})`,
      { status: response.status, code: errorBody?.code ?? null },
    );
  }

  return body.data;
}

/** 화면 표시에 사용할 API 대상 호스트(설정 안내용). */
export function getApiTargetLabel(): string {
  try {
    return new URL(resolveBaseUrl()).host;
  } catch {
    return '설정되지 않음';
  }
}
