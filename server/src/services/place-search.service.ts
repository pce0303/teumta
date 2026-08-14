import type { DestinationSearchResult } from '../dtos';
import { fetchPoiSearch, mapPoiSearchToDestinations } from '../external/tmap';
import { fetchTourPlacesByKeyword, mapSearchResultList } from '../external/tour';
import { prisma } from '../utils/prisma';

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

/**
 * TourAPI 검색 결과에 내부 Place id를 붙인다(적재된 관광지에 한해).
 *
 * 집중률 예측(3.4b)은 내부 placeId로만 조회할 수 있는데 검색 결과는 DB 미저장이라
 * 클라이언트가 두 데이터를 이을 방법이 없었다. `tourApiContentId`로 조회 1회만 수행하며
 * **검색 결과를 Place에 적재하지 않는다**(공모전 데이터 활용 기준 유지).
 *
 * DB 조회 실패는 검색 실패로 취급하지 않는다 — 검색은 외부 API만으로 성립하는 기능이고,
 * placeId는 부가 정보라 null로 두고 부분 성공시킨다(§4 실패 처리 규약).
 */
async function attachInternalPlaceIds(
  results: DestinationSearchResult[],
): Promise<DestinationSearchResult[]> {
  const contentIds = results
    .map((result) => result.tourApiContentId)
    .filter((contentId): contentId is string => contentId !== null);

  if (contentIds.length === 0) {
    return results;
  }

  let placeIdByContentId: Map<string, number>;
  try {
    const places = await prisma.place.findMany({
      where: { tourApiContentId: { in: contentIds } },
      select: { id: true, tourApiContentId: true },
    });
    placeIdByContentId = new Map(
      places.flatMap((place) =>
        place.tourApiContentId === null
          ? []
          : [[place.tourApiContentId, place.id] as const],
      ),
    );
  } catch (error) {
    console.warn('[place-search] 내부 Place 매칭 조회 실패 — placeId 없이 반환', error);
    return results;
  }

  return results.map((result) => ({
    ...result,
    placeId:
      result.tourApiContentId === null
        ? null
        : placeIdByContentId.get(result.tourApiContentId) ?? null,
  }));
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
    return attachInternalPlaceIds(tourResults);
  }

  // TMAP POI에는 tourApiContentId가 없어 내부 Place와 이을 키가 없다(placeId는 계속 null).
  const poiResponse = await fetchPoiSearch(params.keyword, {
    count: TMAP_SEARCH_COUNT,
    page: params.pageNo,
  });
  return mapPoiSearchToDestinations(poiResponse);
}
