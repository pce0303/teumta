import {
  classifyPublicDataResultCode,
  ExternalApiError,
  externalConfig,
  extractPublicDataHeader,
  normalizeResultCode,
  normalizeServiceKey,
  requestJson,
} from '../common';
import type { ConcentrationForecastListResponse } from './prediction.dto';

/**
 * 관광지 집중률 예측(TatsCnctrRateService) 클라이언트. 통신 책임만, 변환은 prediction.mapper.ts.
 * 오퍼레이션은 tatsCnctrRatedList (매뉴얼의 TatsCnctrRatedService/tatsCnctrRateList 표기는 오탈자).
 * PREDICTION_API_KEY 는 Encoding/Decoding 키 모두 허용(normalizeServiceKey가 이중 인코딩 방지).
 */

const SERVICE = 'prediction';
const MOBILE_APP = 'teumta';
const OPERATION = 'tatsCnctrRatedList';

/** 집중률 예측 목록 조회 파라미터. */
export interface ConcentrationForecastParams {
  /** 법정동 시도 코드(필수). */
  areaCd: string | number;
  /** 법정동 시군구 코드(필수, 5자리 전체 코드). */
  signguCd: string | number;
  /** 관광지명 필터(선택). */
  tAtsNm?: string;
  pageNo?: number;
  numOfRows?: number;
}

/**
 * 향후 30일 날짜별 집중률 예측 조회.
 * 실시간 혼잡도가 아니다. 시간대별 예측도 아니다(일 단위, 일 1회 갱신).
 * 결과 코드 '03'(데이터 없음)은 빈 목록으로 정규화한다.
 */
export async function fetchConcentrationForecast(
  params: ConcentrationForecastParams,
): Promise<ConcentrationForecastListResponse> {
  const url = buildPredictionUrl(OPERATION, buildForecastQuery(params));
  const response = await requestJson<ConcentrationForecastListResponse>({ service: SERVICE, url });
  return normalizeForecastResponse(response);
}

/** 요청 쿼리(공통 파라미터 제외)를 만든다. 순수 함수(테스트 용이). 필수값 누락 시 즉시 입력 오류. */
export function buildForecastQuery(params: ConcentrationForecastParams): Record<string, string> {
  const areaCd = String(params.areaCd ?? '').trim();
  const signguCd = String(params.signguCd ?? '').trim();

  if (areaCd.length === 0 || signguCd.length === 0) {
    throw new ExternalApiError(SERVICE, 'areaCd and signguCd are required', {
      code: 'INVALID_PARAM',
    });
  }

  return {
    areaCd,
    signguCd,
    ...(params.tAtsNm !== undefined && params.tAtsNm.trim().length > 0
      ? { tAtsNm: params.tAtsNm.trim() }
      : {}),
    numOfRows: String(params.numOfRows ?? 100),
    pageNo: String(params.pageNo ?? 1),
  };
}

/**
 * 결과 코드 검사(서비스별). 정상 코드가 '0000' 또는 '00'으로 올 수 있어 둘 다 허용한다.
 * '03'(데이터 없음)은 빈 목록으로 정규화하고, 인증 실패/요청 오류는 빈 결과로 숨기지 않는다.
 */
export function normalizeForecastResponse(
  response: ConcentrationForecastListResponse,
): ConcentrationForecastListResponse {
  const header = extractPublicDataHeader(response);
  const rawCode = header?.resultCode ?? 'UNKNOWN';
  const code = normalizeResultCode(rawCode);

  // normalizeResultCode('0000') === '0', normalizeResultCode('00') === '00'
  if (code === '0' || code === '00') {
    return response;
  }
  if (code === '03') {
    return {
      response: {
        header: header ?? { resultCode: rawCode, resultMsg: 'NODATA' },
        body: { items: '', numOfRows: 0, pageNo: 1, totalCount: 0 },
      },
    };
  }
  throw classifyPublicDataResultCode(SERVICE, rawCode, header?.resultMsg ?? 'Unknown error');
}

/** 공통 파라미터(serviceKey/MobileOS/MobileApp/_type) + 개별 파라미터로 요청 URL 구성. */
function buildPredictionUrl(operation: string, params: Record<string, string>): string {
  const { baseUrl, apiKey } = externalConfig.prediction;

  if (!baseUrl) {
    throw new ExternalApiError(SERVICE, 'PREDICTION_API_BASE_URL is not configured', {
      code: 'CONFIG_MISSING',
    });
  }
  if (!apiKey) {
    throw new ExternalApiError(SERVICE, 'PREDICTION_API_KEY is not configured', {
      code: 'CONFIG_MISSING',
    });
  }

  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${operation}`);
  // Encoding/Decoding 키 모두 허용 — 정규화 후 URLSearchParams가 정확히 한 번만 인코딩한다.
  url.searchParams.set('serviceKey', normalizeServiceKey(apiKey));
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', MOBILE_APP);
  url.searchParams.set('_type', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
