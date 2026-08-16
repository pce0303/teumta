import {
  classifyPublicDataResultCode,
  ExternalApiError,
  externalConfig,
  extractPublicDataHeader,
  normalizeResultCode,
  normalizeServiceKey,
  requestJson,
} from '../common';
import type { TourApiDetailResponse, TourApiListResponse } from './tour.dto';

/**
 * 한국관광공사 TourAPI(KorService2) 클라이언트.
 * 통신(URL·인증·timeout) + TourAPI 오류코드 처리까지. 변환은 tour.mapper.ts.
 *
 * v4.4 기준 파라미터: 법정동 코드(lDongRegnCd/lDongSignguCd) + 분류체계(lclsSystm1~3).
 * 구 areaCode/sigunguCode/cat1~3 미사용.
 *
 * TOUR_API_KEY는 Encoding/Decoding 키 모두 허용(normalizeServiceKey가 이중 인코딩 방지).
 * XML 오류 봉투 변환은 공통 http-client 담당.
 */

const SERVICE = 'tour';
const MOBILE_APP = 'teumta';

const RADIUS_MIN_METERS = 1;
const RADIUS_MAX_METERS = 20_000;

/** 지역기반 목록 조회 파라미터(areaBasedList2, v4.4). */
export interface TourAreaListParams {
  /** 법정동 시도 코드. */
  lDongRegnCd?: string | number;
  /** 법정동 시군구 코드. */
  lDongSignguCd?: string | number;
  /** 분류체계 1~3Depth. */
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
  contentTypeId?: string | number;
  /** 수정일 필터(YYYYMMDD). */
  modifiedtime?: string;
  pageNo?: number;
  numOfRows?: number;
  /** 정렬(O=대표이미지 있는 제목순 등). TourAPI 스펙 참고. */
  arrange?: string;
}

/** 위치기반 목록 조회 파라미터(locationBasedList2, v4.4). */
export interface TourLocationListParams {
  /** 경도(longitude). */
  mapX: number;
  /** 위도(latitude). */
  mapY: number;
  /** 반경(m). 1 이상 20000 이하. */
  radius: number;
  contentTypeId?: string | number;
  lDongRegnCd?: string | number;
  lDongSignguCd?: string | number;
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
  pageNo?: number;
  numOfRows?: number;
  arrange?: string;
}

/** areaBasedList2 요청 쿼리(공통 파라미터 제외). 순수 함수. */
export function buildAreaListQuery(params: TourAreaListParams = {}): Record<string, string> {
  return {
    ...optionalParam('lDongRegnCd', params.lDongRegnCd),
    ...optionalParam('lDongSignguCd', params.lDongSignguCd),
    ...optionalParam('lclsSystm1', params.lclsSystm1),
    ...optionalParam('lclsSystm2', params.lclsSystm2),
    ...optionalParam('lclsSystm3', params.lclsSystm3),
    ...optionalParam('contentTypeId', params.contentTypeId),
    ...optionalParam('modifiedtime', params.modifiedtime),
    numOfRows: String(params.numOfRows ?? 20),
    pageNo: String(params.pageNo ?? 1),
    arrange: params.arrange ?? 'O',
  };
}

/**
 * locationBasedList2 요청 쿼리(공통 파라미터 제외). 순수 함수.
 * radius 1~20000(m) 벗어나면 외부 호출 없이 즉시 입력 오류.
 */
export function buildLocationListQuery(params: TourLocationListParams): Record<string, string> {
  assertValidRadius(params.radius);
  return {
    mapX: String(params.mapX),
    mapY: String(params.mapY),
    radius: String(params.radius),
    ...optionalParam('contentTypeId', params.contentTypeId),
    ...optionalParam('lDongRegnCd', params.lDongRegnCd),
    ...optionalParam('lDongSignguCd', params.lDongSignguCd),
    ...optionalParam('lclsSystm1', params.lclsSystm1),
    ...optionalParam('lclsSystm2', params.lclsSystm2),
    ...optionalParam('lclsSystm3', params.lclsSystm3),
    numOfRows: String(params.numOfRows ?? 20),
    pageNo: String(params.pageNo ?? 1),
    // 위치기반 기본 정렬: 거리순(E)
    arrange: params.arrange ?? 'E',
  };
}

/** 지역기반 관광정보 조회(areaBasedList2). */
export async function fetchTourPlacesByArea(
  params: TourAreaListParams = {},
): Promise<TourApiListResponse> {
  return requestTourList(buildTourUrl('areaBasedList2', buildAreaListQuery(params)));
}

/** 위치기반 관광정보 조회(locationBasedList2). 주변 로컬 장소 흐름의 주 진입점. */
export async function fetchTourPlacesByLocation(
  params: TourLocationListParams,
): Promise<TourApiListResponse> {
  return requestTourList(buildTourUrl('locationBasedList2', buildLocationListQuery(params)));
}

function assertValidRadius(radius: number): void {
  if (
    !Number.isFinite(radius) ||
    radius < RADIUS_MIN_METERS ||
    radius > RADIUS_MAX_METERS
  ) {
    throw new ExternalApiError(
      SERVICE,
      `radius must be between ${RADIUS_MIN_METERS} and ${RADIUS_MAX_METERS} meters`,
      { code: 'INVALID_PARAM' },
    );
  }
}

/** 키워드 검색(searchKeyword2) 파라미터. */
export interface TourKeywordSearchParams {
  keyword: string;
  contentTypeId?: string | number;
  lDongRegnCd?: string | number;
  lDongSignguCd?: string | number;
  pageNo?: number;
  numOfRows?: number;
  arrange?: string;
}

/** searchKeyword2 요청 쿼리(공통 파라미터 제외). 순수 함수. keyword 비면 즉시 입력 오류. */
export function buildKeywordSearchQuery(params: TourKeywordSearchParams): Record<string, string> {
  const keyword = params.keyword.trim();
  if (keyword.length === 0) {
    throw new ExternalApiError(SERVICE, 'keyword is required', { code: 'INVALID_PARAM' });
  }
  return {
    keyword,
    ...optionalParam('contentTypeId', params.contentTypeId),
    ...optionalParam('lDongRegnCd', params.lDongRegnCd),
    ...optionalParam('lDongSignguCd', params.lDongSignguCd),
    numOfRows: String(params.numOfRows ?? 20),
    pageNo: String(params.pageNo ?? 1),
    arrange: params.arrange ?? 'O',
  };
}

/** 키워드 검색(searchKeyword2). 목적지 검색 흐름의 진입점. */
export async function fetchTourPlacesByKeyword(
  params: TourKeywordSearchParams,
): Promise<TourApiListResponse> {
  return requestTourList(buildTourUrl('searchKeyword2', buildKeywordSearchQuery(params)));
}

/** 공통정보 조회(detailCommon2). 기준 관광지 좌표 실시간 확보용. */
export async function fetchTourPlaceDetail(
  contentId: string | number,
): Promise<TourApiDetailResponse> {
  const trimmed = String(contentId).trim();
  if (trimmed.length === 0) {
    throw new ExternalApiError(SERVICE, 'contentId is required', { code: 'INVALID_PARAM' });
  }
  // v4.4에서 defaultYN/mapinfoYN 등 플래그는 폐지됨(전달 시 resultCode 10).
  const url = buildTourUrl('detailCommon2', { contentId: trimmed });
  const response = await requestJson<TourApiDetailResponse>({ service: SERVICE, url });
  assertTourApiOk(response);
  return response;
}

/**
 * 소개정보 조회(detailIntro2) — 운영시간·휴무일.
 * contentTypeId가 필수이고, 응답 필드명도 contentTypeId마다 다르다(매퍼에서 흡수).
 */
export async function fetchTourPlaceIntro(
  contentId: string | number,
  contentTypeId: string | number,
): Promise<TourApiDetailResponse> {
  const trimmedId = String(contentId).trim();
  const trimmedTypeId = String(contentTypeId).trim();
  if (trimmedId.length === 0 || trimmedTypeId.length === 0) {
    throw new ExternalApiError(SERVICE, 'contentId and contentTypeId are required', {
      code: 'INVALID_PARAM',
    });
  }
  const url = buildTourUrl('detailIntro2', {
    contentId: trimmedId,
    contentTypeId: trimmedTypeId,
  });
  const response = await requestJson<TourApiDetailResponse>({ service: SERVICE, url });
  assertTourApiOk(response);
  return response;
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
  // Encoding/Decoding 키 모두 허용 — 정규화 후 URLSearchParams가 정확히 한 번만 인코딩
  url.searchParams.set('serviceKey', normalizeServiceKey(apiKey));
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', MOBILE_APP);
  url.searchParams.set('_type', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * 결과 없음(0003 NODATA_ERROR) — 오류가 아니라 "조회 결과 0건".
 * 오류로 던지면 TMAP 폴백을 못 타고 검색 전체가 502(일반 상점 키워드에서 실제 발생).
 */
const NODATA_RESULT_CODE = '03';

/** HTTP 200이어도 resultCode로 논리 오류 통지(중첩·flat 봉투 모두). 정상은 '0000'. */
function assertTourApiOk(response: TourApiListResponse | TourApiDetailResponse): void {
  const header = extractPublicDataHeader(response);
  if (header?.resultCode === '0000') {
    return;
  }
  if (header && normalizeResultCode(header.resultCode) === NODATA_RESULT_CODE) {
    return;
  }
  throw classifyPublicDataResultCode(
    SERVICE,
    header?.resultCode ?? 'UNKNOWN',
    header?.resultMsg ?? 'Unknown error',
  );
}

function optionalParam(key: string, value: string | number | undefined): Record<string, string> {
  return value === undefined ? {} : { [key]: String(value) };
}
