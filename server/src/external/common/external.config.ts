import { env } from '../../config/env';

/**
 * 외부 서비스별 설정(base URL, API key)과 공통 통신 설정을 한곳에서 관리한다.
 * 실제 값은 환경변수(`src/config/env.ts`)에서 오며, 코드/Git에는 키를 두지 않는다.
 *
 * TODO: 각 API 공식 스펙 확인 후 base URL 기본값/경로 규칙을 확정한다.
 */
export const externalConfig = {
  /** 공통 요청 timeout(ms). */
  timeoutMs: env.EXTERNAL_API_TIMEOUT_MS,

  tour: {
    baseUrl: env.TOUR_API_BASE_URL,
    apiKey: env.TOUR_API_KEY,
  },
  congestion: {
    baseUrl: env.CONGESTION_API_BASE_URL,
    apiKey: env.CONGESTION_API_KEY,
  },
  tmap: {
    baseUrl: env.TMAP_API_BASE_URL,
    apiKey: env.TMAP_API_KEY,
  },
  prediction: {
    baseUrl: env.PREDICTION_API_BASE_URL,
    apiKey: env.PREDICTION_API_KEY,
  },
} as const;

export type ExternalServiceName = Exclude<keyof typeof externalConfig, 'timeoutMs'>;
