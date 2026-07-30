import { ExternalApiError } from '../common';
// import { externalConfig, requestJson } from '../common';
import type { TourApiPlaceListResponse } from './tour.dto';

/**
 * 한국관광공사 TourAPI 클라이언트.
 * 통신(URL/인증/timeout) 책임만 가진다. 변환은 tour.mapper.ts가 담당한다.
 *
 * ⚠️ 이번 작업 범위에서는 실제 호출을 하지 않는다(skeleton + TODO).
 */

/** 장소 목록 조회 파라미터. TODO: 공식 스펙 확인 후 확정. */
export interface TourPlaceSearchParams {
  // TODO: keyword, areaCode, contentTypeId, pageNo, numOfRows 등
  [key: string]: unknown;
}

/**
 * 관광지/로컬 장소 목록 조회.
 * TODO(실제 연동 시):
 *  - externalConfig.tour.baseUrl / apiKey 로 요청 URL 구성
 *  - requestJson<TourApiPlaceListResponse>({ service: 'tour', url }) 호출
 */
export async function fetchTourPlaces(
  _params: TourPlaceSearchParams,
): Promise<TourApiPlaceListResponse> {
  throw new ExternalApiError('tour', 'TourAPI client is not implemented yet', {
    code: 'NOT_IMPLEMENTED',
  });
}
