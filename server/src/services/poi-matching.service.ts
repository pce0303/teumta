import { fetchPoiSearch, mapPoiSearchToDestinations } from '../external/tmap';
import { extractDetailCoordinate, extractDetailItem, fetchTourPlaceDetail } from '../external/tour';
import { distanceMeters, type GeoPoint } from '../utils/geo';
import { placeNameRank } from '../utils/place-name';

/**
 * TourAPI 관광지(contentId) → TMAP POI(poiId) 매칭.
 *
 * 왜 필요한가: SK 퍼즐 실시간 혼잡도는 TMAP poiId로만 조회된다. 그런데 검색은 TourAPI를
 * 우선하므로 유명 관광지일수록 `source=TOUR`로 잡혀 `tmapPoiId`가 없고, 결국
 * **혼잡이 가장 문제되는 장소에서 실시간 혼잡도를 못 보여주는** 상황이 된다.
 * 오버투어리즘 완화가 목적인 서비스에서 이건 핵심 기능의 구멍이라 서버가 이어준다.
 *
 * 왜 검색 응답에 미리 붙이지 않는가: 검색 결과 20건마다 TMAP POI 검색을 돌리면 호출량과
 * 응답시간이 20배가 된다. 사용자가 실제로 여는 목적지는 하나이므로 **조회 시점에 해석**하고
 * 결과를 캐시한다.
 */

/**
 * 이름이 같아도 다른 장소일 수 있어(전국에 "경복궁"이라는 상호가 여럿) 좌표로 검증한다.
 * TourAPI와 TMAP의 대표 좌표가 같은 시설에서도 수백 m 차이날 수 있어 300m로 둔다.
 */
export const POI_MATCH_RADIUS_METERS = 300;

/** 매칭 결과 캐시 TTL. 관광지↔POI 대응은 사실상 고정이라 길게 잡는다. */
export const POI_MATCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** TMAP POI 검색에서 확인할 후보 수. 상위 몇 개면 충분하고 응답도 가볍다. */
const POI_SEARCH_COUNT = 5;

interface CacheEntry {
  /** 매칭 실패도 캐시한다(같은 장소로 반복 호출해 쿼터를 태우지 않도록). */
  poiId: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** 테스트용 캐시 초기화. */
export function clearPoiMatchCache(): void {
  cache.clear();
}

/**
 * TourAPI contentId에 대응하는 TMAP poiId를 찾는다. 못 찾으면 null.
 * 외부 호출은 최초 1회(TourAPI 상세 1 + TMAP POI 검색 1)이고 이후에는 캐시에서 답한다.
 */
export async function resolveTmapPoiId(contentId: string): Promise<string | null> {
  const key = contentId.trim();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.poiId;
  }

  const poiId = await lookupTmapPoiId(key);
  cache.set(key, { poiId, expiresAt: Date.now() + POI_MATCH_CACHE_TTL_MS });
  return poiId;
}

async function lookupTmapPoiId(contentId: string): Promise<string | null> {
  const detail = await fetchTourPlaceDetail(contentId);
  const item = extractDetailItem(detail);
  const coordinate = extractDetailCoordinate(detail);
  const name = item?.title?.trim();

  // 이름이나 좌표가 없으면 검증 자체가 불가능하다(이름만으로 잇는 것은 오매칭 위험).
  if (!name || !coordinate) {
    return null;
  }

  const candidates = mapPoiSearchToDestinations(
    await fetchPoiSearch(name, { count: POI_SEARCH_COUNT }),
  );

  return pickBestPoiMatch(candidates, { name, coordinate });
}

export interface PoiCandidate {
  tmapPoiId: string | null;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * 반경 안에서 가장 잘 맞는 후보의 poiId. 반경 밖만 있으면 null(억지 매칭 금지).
 *
 * **거리만으로 고르면 안 된다.** TMAP은 본 시설과 부속 시설을 각각 POI로 주는데
 * (예: "전주한옥마을" / "전주한옥마을 관광안내소" — id가 다르다) 부속 시설이 몇 m 더 가까운 경우가
 * 실제로 있고, SK 혼잡도는 본 시설 POI만 커버해서 엉뚱한 id를 고르면 "데이터 없음"이 된다.
 * 그래서 이름 일치도를 먼저 보고 거리로 동점을 가린다.
 *
 * 이름 비교는 공백·대괄호 표기를 걷어낸 뒤 포함 관계까지 본다 — TourAPI는
 * "전북 전주 한옥마을 [슬로시티]"처럼 지역 접두사와 부가 표기를 붙여 주기 때문이다.
 */
export function pickBestPoiMatch(
  candidates: PoiCandidate[],
  target: { name: string; coordinate: GeoPoint },
): string | null {
  let best: { poiId: string; rank: number; distance: number } | null = null;

  for (const candidate of candidates) {
    if (candidate.tmapPoiId === null || candidate.latitude === null || candidate.longitude === null) {
      continue;
    }

    const distance = distanceMeters(target.coordinate, {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    });
    if (distance > POI_MATCH_RADIUS_METERS) {
      continue;
    }

    const rank = placeNameRank(candidate.name, target.name);
    const better =
      best === null || rank < best.rank || (rank === best.rank && distance < best.distance);

    if (better) {
      best = { poiId: candidate.tmapPoiId, rank, distance };
    }
  }

  return best?.poiId ?? null;
}
