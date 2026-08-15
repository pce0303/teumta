import { PlaceType } from '@prisma/client';

import type { DestinationSearchResult, NearbyLocalPlaceCandidate, PlaceData } from '../../dtos';
import { ExternalApiResponseError } from '../common';
import type {
  TourApiDetailItem,
  TourApiDetailResponse,
  TourApiListResponse,
  TourApiPlaceItem,
} from './tour.dto';

/**
 * TourAPI 원본 → 틈타 내부 PlaceData 변환.
 *
 * 미매핑(향후 detailCommon2 / detailIntro2 추가 호출 필요):
 *  - description: detailCommon2 의 overview
 *  - openingTime / closingTime: detailIntro2 의 운영시간(contentTypeId별 필드 상이, 자유텍스트 파싱 필요)
 *  - recommendedDuration: TourAPI 미제공(내부 규칙으로 산정 예정)
 */

/**
 * LOCAL_PLACE(로컬 장소)로 볼 contentTypeId 집합.
 * 39=음식점, 38=쇼핑. 그 외(12 관광지, 14 문화시설, 15 축제, 25 여행코스, 28 레포츠, 32 숙박)는 TOURIST_SPOT.
 * 정책 변경 시 테스트(tour.mapper.test.ts)로 의도를 고정한다.
 */
const LOCAL_PLACE_CONTENT_TYPE_IDS = new Set(['38', '39']);

export function mapContentTypeIdToPlaceType(contentTypeId: string): PlaceType {
  return LOCAL_PLACE_CONTENT_TYPE_IDS.has(contentTypeId)
    ? PlaceType.LOCAL_PLACE
    : PlaceType.TOURIST_SPOT;
}

/** 목록 변환 결과. 좌표 불량 등 유효하지 않은 항목은 전체를 실패시키지 않고 skip 집계한다. */
export interface TourPlaceListMapResult {
  places: PlaceData[];
  skipped: { contentId: string; reason: string }[];
}

/**
 * 목록 응답 전체 → PlaceData[] + skip 집계.
 * 좌표가 없는 항목 하나 때문에 전체 페이지 적재가 실패하지 않도록, 항목 단위로 오류를 격리한다.
 */
export function mapTourPlaceListDetailed(response: TourApiListResponse): TourPlaceListMapResult {
  const places: PlaceData[] = [];
  const skipped: { contentId: string; reason: string }[] = [];

  for (const item of extractItems(response)) {
    try {
      places.push(mapTourPlaceToPlaceData(item));
    } catch (error) {
      skipped.push({
        contentId: String(item.contentid ?? 'unknown'),
        reason: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
  return { places, skipped };
}

/** 목록 응답 전체 → PlaceData[]. 유효하지 않은 항목은 조용히 제외된다(집계가 필요하면 Detailed 사용). */
export function mapTourPlaceList(response: TourApiListResponse): PlaceData[] {
  return mapTourPlaceListDetailed(response).places;
}

/** 응답에서 항목 배열을 안전하게 추출한다(items="" 또는 단일 객체 케이스 방어). */
export function extractItems(response: TourApiListResponse): TourApiPlaceItem[] {
  // items 는 결과가 없으면 빈 문자열("")로 오므로 falsy 체크로 함께 걸러진다.
  const items = response.response?.body?.items;
  if (!items) {
    return [];
  }
  const item = items.item;
  if (Array.isArray(item)) {
    return item;
  }
  return item ? [item] : [];
}

export function mapTourPlaceToPlaceData(item: TourApiPlaceItem): PlaceData {
  return {
    tourApiContentId: String(item.contentid),
    name: item.title,
    type: mapContentTypeIdToPlaceType(String(item.contenttypeid)),
    address: buildAddress(item.addr1, item.addr2),
    latitude: parseCoordinate(item.mapy, 'mapy', item.contentid),
    longitude: parseCoordinate(item.mapx, 'mapx', item.contentid),
    imageUrl: item.firstimage || item.firstimage2 || null,
    description: null,
    openingTime: null,
    closingTime: null,
    recommendedDuration: null,
    lDongRegnCd: emptyToNull(item.lDongRegnCd),
    lDongSignguCd: emptyToNull(item.lDongSignguCd),
    lclsSystm1: emptyToNull(item.lclsSystm1),
    lclsSystm2: emptyToNull(item.lclsSystm2),
    lclsSystm3: emptyToNull(item.lclsSystm3),
  };
}

// 실시간 주변 로컬 장소 매핑(요청 스코프 전용, DB 미저장)

/** locationBasedList2 → 후보[]. 좌표 없는 항목은 제외. */
export function mapNearbyCandidateList(response: TourApiListResponse): NearbyLocalPlaceCandidate[] {
  const candidates: NearbyLocalPlaceCandidate[] = [];
  for (const item of extractItems(response)) {
    const candidate = mapNearbyCandidate(item);
    if (candidate) {
      candidates.push(candidate);
    }
  }
  return candidates;
}

/** 단일 목록 항목 → 후보. 좌표가 유효하지 않으면 null. */
export function mapNearbyCandidate(item: TourApiPlaceItem): NearbyLocalPlaceCandidate | null {
  const latitude = safeCoordinate(item.mapy);
  const longitude = safeCoordinate(item.mapx);
  if (latitude === null || longitude === null) {
    return null;
  }
  const tourDistance = Number(item.dist);
  return {
    tourApiContentId: String(item.contentid),
    contentTypeId: item.contenttypeid === undefined ? null : String(item.contenttypeid),
    categoryCode: item.cat3 ? String(item.cat3) : null,
    name: item.title,
    address: buildAddress(item.addr1, item.addr2),
    latitude,
    longitude,
    imageUrl: item.firstimage || item.firstimage2 || null,
    tourDistanceMeters: Number.isFinite(tourDistance) ? tourDistance : null,
  };
}

/** searchKeyword2 목록 → 검색 결과[]. 좌표 없는 항목도 목록에는 포함(null 좌표). */
export function mapSearchResultList(response: TourApiListResponse): DestinationSearchResult[] {
  return extractItems(response).map((item) => ({
    source: 'TOUR' as const,
    tourApiContentId: String(item.contentid),
    tmapPoiId: null,
    contentTypeId: String(item.contenttypeid),
    name: item.title,
    address: buildAddress(item.addr1, item.addr2),
    latitude: safeCoordinate(item.mapy),
    longitude: safeCoordinate(item.mapx),
    imageUrl: item.firstimage || item.firstimage2 || null,
    // 매퍼는 DB를 모른다. 내부 Place 매칭은 place-search.service에서 붙인다.
    placeId: null,
  }));
}

/** detailCommon2 응답의 상세 항목 추출(items="" / 단일 객체 방어). */
export function extractDetailItem(response: TourApiDetailResponse): TourApiDetailItem | null {
  const items = response.response?.body?.items;
  if (!items) {
    return null;
  }
  const item = items.item;
  if (Array.isArray(item)) {
    return item[0] ?? null;
  }
  return item ?? null;
}

/** detailCommon2 → 기준 좌표. 없으면 null(호출부에서 fallback). */
export function extractDetailCoordinate(
  response: TourApiDetailResponse,
): { latitude: number; longitude: number } | null {
  const item = extractDetailItem(response);
  if (!item) {
    return null;
  }
  const latitude = safeCoordinate(item.mapy);
  const longitude = safeCoordinate(item.mapx);
  if (latitude === null || longitude === null) {
    return null;
  }
  return { latitude, longitude };
}

/** 좌표 문자열 → number | null. 빈 값/0/NaN은 null(throw 없음). */
function safeCoordinate(value: string | undefined): number | null {
  if (value === undefined || String(value).trim() === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) {
    return null;
  }
  return parsed;
}

function buildAddress(addr1?: string, addr2?: string): string | null {
  const full = [addr1, addr2]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(' ');
  return full.length > 0 ? full : null;
}

/** 좌표 문자열 → number. TourAPI는 빈 값을 ""로 주므로 0/NaN을 유효하지 않은 좌표로 간주한다. */
function parseCoordinate(value: string | undefined, field: string, contentId: string): number {
  if (value === undefined || String(value).trim() === '') {
    throw new ExternalApiResponseError('tour', `Missing ${field} for content ${contentId}`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) {
    throw new ExternalApiResponseError('tour', `Invalid ${field} for content ${contentId}`);
  }
  return parsed;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}
