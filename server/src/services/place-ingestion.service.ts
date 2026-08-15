import { Prisma, PlaceType } from '@prisma/client';

import type { PlaceData } from '../dtos';
import {
  fetchTourPlacesByArea,
  fetchTourPlacesByLocation,
  mapTourPlaceListDetailed,
  type TourAreaListParams,
  type TourLocationListParams,
  type TourPlaceListMapResult,
} from '../external/tour';
import { prisma } from '../utils/prisma';

/**
 * 외부 장소 데이터(TourAPI) → Place 테이블 적재.
 *
 * ⚠️ 공모전 기준: 주변 로컬 장소 API 런타임에서 호출 금지.
 *    집중률 매칭용 참조 데이터 적재(ingest:tour 스크립트) 전용.
 *
 * 역할 경계: Place 쓰기(upsert)는 B, 키는 tourApiContentId. A는 읽기만.
 * fetch → map → upsert 오케스트레이션 — 컨트롤러는 외부 API를 직접 부르지 않는다.
 */

export interface PlaceUpsertResult {
  created: number;
  updated: number;
  /** 제외 항목 수(좌표 불량·tourApiContentId 누락 등). */
  skipped: number;
  /** 제외 사유 집계(contentId: 사유). API 키·URL 등 민감정보 미포함. */
  skippedReasons: string[];
  total: number;
}

/**
 * PlaceData 목록 upsert(tourApiContentId 기준).
 * 외부 API 없이 동작 — mapper 출력만으로 단독 테스트 가능.
 */
export async function upsertPlaces(places: PlaceData[]): Promise<PlaceUpsertResult> {
  const targets = places.filter((place) => place.tourApiContentId.length > 0);
  const skippedReasons = places
    .filter((place) => place.tourApiContentId.length === 0)
    .map(() => 'missing tourApiContentId');
  const skipped = skippedReasons.length;

  if (targets.length === 0) {
    return { created: 0, updated: 0, skipped, skippedReasons, total: places.length };
  }

  const contentIds = targets.map((place) => place.tourApiContentId);
  const existing = await prisma.place.findMany({
    where: { tourApiContentId: { in: contentIds } },
    select: { tourApiContentId: true },
  });
  const existingIds = new Set(existing.map((row) => row.tourApiContentId));

  await prisma.$transaction(
    targets.map((place) =>
      prisma.place.upsert({
        where: { tourApiContentId: place.tourApiContentId },
        create: toPlaceCreateInput(place),
        update: toPlaceUpdateInput(place),
      }),
    ),
  );

  const updated = targets.filter((place) => existingIds.has(place.tourApiContentId)).length;
  return {
    created: targets.length - updated,
    updated,
    skipped,
    skippedReasons,
    total: places.length,
  };
}

/** TourAPI 위치기반 조회 결과 적재(fetch → map → upsert). 유효한 키 필요. */
export async function ingestTourPlacesByLocation(
  params: TourLocationListParams,
): Promise<PlaceUpsertResult> {
  const response = await fetchTourPlacesByLocation(params);
  return upsertMappedPlaces(mapTourPlaceListDetailed(response));
}

/** TourAPI 지역기반 조회 결과 적재. 유효한 키 필요. */
export async function ingestTourPlacesByArea(
  params: TourAreaListParams = {},
): Promise<PlaceUpsertResult> {
  const response = await fetchTourPlacesByArea(params);
  return upsertMappedPlaces(mapTourPlaceListDetailed(response));
}

/**
 * 매퍼 skip(좌표 불량)과 upsert skip(contentId 누락) 합산.
 * 좌표 없는 항목 하나로 전체 페이지 적재가 실패하지 않게.
 */
async function upsertMappedPlaces(mapResult: TourPlaceListMapResult): Promise<PlaceUpsertResult> {
  const result = await upsertPlaces(mapResult.places);
  const mapperReasons = mapResult.skipped.map(
    (entry) => `content ${entry.contentId}: ${entry.reason}`,
  );
  return {
    ...result,
    skipped: result.skipped + mapResult.skipped.length,
    skippedReasons: [...mapperReasons, ...result.skippedReasons],
    total: result.total + mapResult.skipped.length,
  };
}

/** 신규 생성 — 목록에서 얻은 모든 필드 삽입. */
export function toPlaceCreateInput(place: PlaceData): Prisma.PlaceCreateInput {
  return {
    tourApiContentId: place.tourApiContentId,
    name: place.name,
    type: place.type ?? PlaceType.TOURIST_SPOT,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    imageUrl: place.imageUrl,
    description: place.description,
    openingTime: place.openingTime,
    closingTime: place.closingTime,
    recommendedDuration: place.recommendedDuration,
    lDongRegnCd: place.lDongRegnCd ?? null,
    lDongSignguCd: place.lDongSignguCd ?? null,
    lclsSystm1: place.lclsSystm1 ?? null,
    lclsSystm2: place.lclsSystm2 ?? null,
    lclsSystm3: place.lclsSystm3 ?? null,
  };
}

/**
 * 갱신 — 목록 조회로 신뢰 가능한 필드만 덮어쓰기.
 * description·openingTime·closingTime·recommendedDuration은 상세 조회나 다른 경로로 채워지므로
 * 목록 재적재가 null로 덮어쓰지 않도록 제외.
 */
export function toPlaceUpdateInput(place: PlaceData): Prisma.PlaceUpdateInput {
  return {
    name: place.name,
    type: place.type ?? PlaceType.TOURIST_SPOT,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    imageUrl: place.imageUrl,
    // 법정동·분류체계 코드는 응답에 없을 수 있어 값이 있을 때만 갱신
    // — 재적재가 null로 덮어쓰면 집중률 매칭이 깨짐
    ...(place.lDongRegnCd != null ? { lDongRegnCd: place.lDongRegnCd } : {}),
    ...(place.lDongSignguCd != null ? { lDongSignguCd: place.lDongSignguCd } : {}),
    ...(place.lclsSystm1 != null ? { lclsSystm1: place.lclsSystm1 } : {}),
    ...(place.lclsSystm2 != null ? { lclsSystm2: place.lclsSystm2 } : {}),
    ...(place.lclsSystm3 != null ? { lclsSystm3: place.lclsSystm3 } : {}),
  };
}
