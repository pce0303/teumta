import type { TourPlaceSearchResult } from '../dtos';
import { fetchTourPlacesByKeyword, mapSearchResultList } from '../external/tour';

/**
 * 목적지 검색(실시간 TourAPI searchKeyword2, DB 미저장).
 * 사용자가 검색 결과에서 목적지를 고르면 contentId로 주변 로컬 장소를 조회한다.
 */

export interface SearchTourPlacesParams {
  keyword: string;
  /** 기본은 관광지(12)만. 필요 시 다른 타입 허용. */
  contentTypeId?: string;
  pageNo?: number;
  numOfRows?: number;
}

export async function searchTourPlaces(
  params: SearchTourPlacesParams,
): Promise<TourPlaceSearchResult[]> {
  const response = await fetchTourPlacesByKeyword({
    keyword: params.keyword,
    contentTypeId: params.contentTypeId ?? '12',
    pageNo: params.pageNo,
    numOfRows: params.numOfRows ?? 20,
  });
  return mapSearchResultList(response);
}
