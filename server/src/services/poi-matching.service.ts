import { fetchPoiSearch, mapPoiSearchToDestinations } from '../external/tmap';
import { extractDetailCoordinate, extractDetailItem, fetchTourPlaceDetail } from '../external/tour';
import { distanceMeters, type GeoPoint } from '../utils/geo';
import { placeNameRank } from '../utils/place-name';
import { TtlCache } from '../utils/ttl-cache';

/**
 * TourAPI 관광지(contentId) → TMAP POI(poiId) 매칭.
 *
 * 필요한 이유: SK 퍼즐 혼잡도는 TMAP poiId로만 조회 가능. 검색은 TourAPI 우선이라
 * 유명 관광지일수록 `source=TOUR`로 잡혀 `tmapPoiId`가 없음 →
 * **혼잡이 가장 심한 곳에서 실시간 혼잡도 표시 불가**. 서버가 이어준다.
 *
 * 검색 응답에 미리 안 붙이는 이유: 결과 20건마다 POI 검색이면 호출량·응답시간 20배.
 * 실제로 여는 목적지는 하나 → 조회 시점 해석 + 캐시.
 */

/**
 * 동명이소 방지용 좌표 검증 반경(전국에 "경복궁" 상호가 여럿).
 * 같은 시설이어도 TourAPI·TMAP 대표 좌표가 수백 m 차이나서 300m.
 */
export const POI_MATCH_RADIUS_METERS = 300;

/** 매칭 캐시 TTL. 관광지↔POI 대응은 사실상 고정이라 길게. */
export const POI_MATCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** POI 검색 후보 확인 수. 상위 몇 개면 충분. */
const POI_SEARCH_COUNT = 5;

/**
 * 상한 — 상세를 연 목적지마다 키가 쌓이는 캐시라 무한 성장 방지가 특히 중요.
 * 값으로 null(매칭 실패)도 저장한다 — 같은 장소 반복 호출로 쿼터를 태우지 않기 위함.
 * 외부 오류로 lookup 자체가 던지면 캐시하지 않는다(일시 장애를 24시간 박제하면 안 됨).
 */
const POI_MATCH_CACHE_MAX_ENTRIES = 2000;

const cache = new TtlCache<string | null>(POI_MATCH_CACHE_TTL_MS, POI_MATCH_CACHE_MAX_ENTRIES);

/** 테스트용 캐시 초기화. */
export function clearPoiMatchCache(): void {
  cache.clear();
}

/**
 * contentId에 대응하는 TMAP poiId. 없으면 null.
 * 외부 호출은 최초 1회(TourAPI 상세 1 + POI 검색 1), 이후 캐시.
 * 같은 contentId 동시 미스도 호출 1회를 공유한다.
 */
export async function resolveTmapPoiId(contentId: string): Promise<string | null> {
  const key = contentId.trim();
  return cache.getOrCreate(key, () => lookupTmapPoiId(key));
}

async function lookupTmapPoiId(contentId: string): Promise<string | null> {
  const detail = await fetchTourPlaceDetail(contentId);
  const item = extractDetailItem(detail);
  const coordinate = extractDetailCoordinate(detail);
  const name = item?.title?.trim();

  // 이름·좌표 없으면 검증 불가 — 이름만으로 잇는 건 오매칭 위험
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
 * 반경 안 최적 후보의 poiId. 반경 밖만 있으면 null(억지 매칭 금지).
 *
 * **거리만으로 고르면 안 됨.** TMAP은 본 시설과 부속 시설을 각각 POI로 제공
 * ("전주한옥마을" / "전주한옥마을 관광안내소" — id 다름). 부속이 몇 m 더 가까운 경우가 실제로 있고
 * SK 혼잡도는 본 시설만 커버 → 엉뚱한 id면 "데이터 없음".
 * 그래서 이름 일치도 우선, 거리로 동점 처리.
 *
 * 이름 비교는 공백·대괄호를 걷어낸 뒤 포함 관계까지 — TourAPI가
 * "전북 전주 한옥마을 [슬로시티]"처럼 지역 접두사·부가 표기를 붙이기 때문.
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
