import {
  ExternalApiAuthError,
  ExternalApiError,
  ExternalApiRateLimitError,
  ExternalApiResponseError,
  externalConfig,
  requestJson,
} from '../common';
import type { TourApiListResponse } from './tour.dto';

/**
 * 한국관광공사 TourAPI (KorService2) 클라이언트.
 * 통신(URL/인증/timeout)과 TourAPI 자체 오류코드 처리까지만 담당한다. 변환은 tour.mapper.ts.
 *
 * ⚠️ 실제 호출 코드지만, 유효한 TOUR_API_KEY / TOUR_API_BASE_URL 이 설정되기 전에는 동작하지 않는다.
 *    (키 미설정 시 CONFIG_MISSING 으로 즉시 실패)
 *
 * 키 관련 주의:
 *  - .env 의 TOUR_API_KEY 에는 공공데이터포털의 "Decoding" 키를 넣는다.
 *    (URLSearchParams가 한 번 인코딩하므로 Encoding 키를 넣으면 이중 인코딩되어 실패)
 *  - 서비스 키 오류 등 일부 케이스는 게이트웨이가 JSON이 아닌 XML 오류 봉투를 반환할 수 있는데,
 *    이 경우 JSON 파싱 실패(ExternalApiResponseError)로 표면화된다.
 */

const SERVICE = 'tour';
const MOBILE_APP = 'teumta';

/** 지역기반 목록 조회 파라미터. */
export interface TourAreaListParams {
  areaCode?: string | number;
  sigunguCode?: string | number;
  contentTypeId?: string | number;
  pageNo?: number;
  numOfRows?: number;
  /** 정렬(O=대표이미지 있는 항목 우선 등). TourAPI 스펙 참고. */
  arrange?: string;
}

/** 위치기반 목록 조회 파라미터. */
export interface TourLocationListParams {
  /** 경도(longitude). */
  mapX: number;
  /** 위도(latitude). */
  mapY: number;
  /** 반경(m, 최대 20000). */
  radius: number;
  contentTypeId?: string | number;
  pageNo?: number;
  numOfRows?: number;
  arrange?: string;
}

/** 지역기반 관광정보 조회(areaBasedList2). */
export async function fetchTourPlacesByArea(
  params: TourAreaListParams = {},
): Promise<TourApiListResponse> {
  const url = buildTourUrl('areaBasedList2', {
    ...optionalParam('areaCode', params.areaCode),
    ...optionalParam('sigunguCode', params.sigunguCode),
    ...optionalParam('contentTypeId', params.contentTypeId),
    numOfRows: String(params.numOfRows ?? 20),
    pageNo: String(params.pageNo ?? 1),
    arrange: params.arrange ?? 'O',
  });
  return requestTourList(url);
}

/** 위치기반 관광정보 조회(locationBasedList2). "빈 시간 근처 관광지" 시나리오의 주 진입점. */
export async function fetchTourPlacesByLocation(
  params: TourLocationListParams,
): Promise<TourApiListResponse> {
  const url = buildTourUrl('locationBasedList2', {
    mapX: String(params.mapX),
    mapY: String(params.mapY),
    radius: String(params.radius),
    ...optionalParam('contentTypeId', params.contentTypeId),
    numOfRows: String(params.numOfRows ?? 20),
    pageNo: String(params.pageNo ?? 1),
    arrange: params.arrange ?? 'E',
  });
  return requestTourList(url);
}

async function requestTourList(url: string): Promise<TourApiListResponse> {
  const response = await requestJson<TourApiListResponse>({ service: SERVICE, url });
  assertTourApiOk(response);
  return response;
}

/** 공통 파라미터(serviceKey/MobileOS/MobileApp/_type) + 개별 파라미터로 요청 URL 구성. */
function buildTourUrl(operation: string, params: Record<string, string>): string {
  const { baseUrl, apiKey } = externalConfig.tour;

  if (!baseUrl) {
    throw new ExternalApiError(SERVICE, 'TOUR_API_BASE_URL is not configured', {
      code: 'CONFIG_MISSING',
    });
  }
  if (!apiKey) {
    throw new ExternalApiError(SERVICE, 'TOUR_API_KEY is not configured', {
      code: 'CONFIG_MISSING',
    });
  }

  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${operation}`);
  // serviceKey 는 Decoding 키를 넣고 URLSearchParams가 한 번만 인코딩하도록 한다.
  url.searchParams.set('serviceKey', apiKey);
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', MOBILE_APP);
  url.searchParams.set('_type', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/** TourAPI는 HTTP 200이어도 header.resultCode로 논리 오류를 알린다. 이를 오류 계층으로 변환한다. */
function assertTourApiOk(response: TourApiListResponse): void {
  const header = response.response?.header;
  const code = header?.resultCode;

  if (code === '0000') {
    return;
  }

  // 30: 등록되지 않은 서비스키, 31: 활용기간 만료, 32: 등록되지 않은 IP 등 인증 계열
  if (code === '30' || code === '31' || code === '32') {
    throw new ExternalApiAuthError(SERVICE);
  }
  // 22: 서비스 요청제한 횟수 초과
  if (code === '22') {
    throw new ExternalApiRateLimitError(SERVICE);
  }

  const message = header?.resultMsg ?? 'Unknown error';
  throw new ExternalApiResponseError(SERVICE, `TourAPI returned resultCode ${code}: ${message}`);
}

function optionalParam(key: string, value: string | number | undefined): Record<string, string> {
  return value === undefined ? {} : { [key]: String(value) };
}
