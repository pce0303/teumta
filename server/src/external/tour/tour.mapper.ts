import { PlaceType } from '@prisma/client';

import type { PlaceData } from '../../dtos';
import { ExternalApiResponseError } from '../common';
import type { TourApiListResponse, TourApiPlaceItem } from './tour.dto';

/**
 * TourAPI 원본 → 틈타 내부 PlaceData 변환.
 *
 * ⚠️ 공식 스펙 기반 구현. 실제 응답 샘플로 필드/타입 매핑을 한 번 더 검증할 것.
 *
 * 미매핑(향후 detailCommon2 / detailIntro2 추가 호출 필요):
 *  - description: detailCommon2 의 overview
 *  - openingTime / closingTime: detailIntro2 의 운영시간(contentTypeId별 필드 상이, 자유텍스트 파싱 필요)
 *  - recommendedDuration: TourAPI 미제공(내부 규칙으로 산정 예정)
 */

/**
 * LOCAL_PLACE(로컬 장소)로 볼 contentTypeId 집합.
 * 39=음식점, 38=쇼핑. 그 외(12 관광지, 14 문화시설, 15 축제, 25 여행코스, 28 레포츠, 32 숙박)는 TOURIST_SPOT.
 * TODO: 서비스 정책에 맞게 A와 최종 확정.
 */
const LOCAL_PLACE_CONTENT_TYPE_IDS = new Set(['38', '39']);

export function mapContentTypeIdToPlaceType(contentTypeId: string): PlaceType {
  return LOCAL_PLACE_CONTENT_TYPE_IDS.has(contentTypeId)
    ? PlaceType.LOCAL_PLACE
    : PlaceType.TOURIST_SPOT;
}

/** 목록 응답 전체 → PlaceData[]. 빈 결과/단일 결과 케이스를 안전하게 처리한다. */
export function mapTourPlaceList(response: TourApiListResponse): PlaceData[] {
  return extractItems(response).map(mapTourPlaceToPlaceData);
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
  };
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
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) {
    throw new ExternalApiResponseError('tour', `Invalid ${field} for content ${contentId}`);
  }
  return parsed;
}
