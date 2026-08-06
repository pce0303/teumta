import type { DestinationSearchResult } from '../dtos';
import { fetchPoiSearch, mapPoiSearchToDestinations } from '../external/tmap';
import { fetchTourPlacesByKeyword, mapSearchResultList } from '../external/tour';

/**
 * 목적지 검색(실시간, DB 미저장). TourAPI(관광지, 상세정보 풍부) 우선,
 * 결과가 없으면 TMAP POI 검색으로 폴백(일반 상점·건물 등 전국 POI).
 * 폴백 구조라 검색 1회당 외부 호출은 보통 1건, 최대 2건(쿼터 절약).
 */

const TMAP_SEARCH_COUNT = 10;

export interface SearchDestinationsParams {
  keyword: string;
  pageNo?: number;
  numOfRows?: number;
}

export async function searchDestinations(
  params: SearchDestinationsParams,
): Promise<DestinationSearchResult[]> {
  const tourResponse = await fetchTourPlacesByKeyword({
    keyword: params.keyword,
    contentTypeId: '12',
    pageNo: params.pageNo,
    numOfRows: params.numOfRows ?? 20,
  });
  const tourResults = mapSearchResultList(tourResponse);
  if (tourResults.length > 0) {
    return tourResults;
  }

  const poiResponse = await fetchPoiSearch(params.keyword, {
    count: TMAP_SEARCH_COUNT,
    page: params.pageNo,
  });
  return mapPoiSearchToDestinations(poiResponse);
}
