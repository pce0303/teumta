import { Prisma, PlaceType } from '@prisma/client';

import type { PlaceData } from '../dtos';
import {
  fetchTourPlacesByArea,
  fetchTourPlacesByLocation,
  mapTourPlaceList,
  type TourAreaListParams,
  type TourLocationListParams,
} from '../external/tour';
import { prisma } from '../utils/prisma';

/**
 * 외부 장소 데이터(현재는 TourAPI)를 내부 Place 테이블에 적재하는 서비스.
 *
 * 역할 경계(협업 규칙):
 *  - B(외부 연동)가 Place에 대한 "쓰기(upsert)"를 담당한다. upsert 키는 tourApiContentId.
 *  - A(도메인)는 Place를 "읽기"만 한다(place.service.ts는 건드리지 않는다).
 *
 * 이 서비스는 fetch → map → upsert 를 오케스트레이션한다.
 * controller에서 외부 API를 직접 호출하지 않고, 이 서비스를 통해서만 연동한다.
 */

export interface PlaceUpsertResult {
  created: number;
  updated: number;
  /** tourApiContentId가 없어 건너뛴 항목 수. */
  skipped: number;
  total: number;
}

/**
 * PlaceData 목록을 Place 테이블에 upsert 한다(tourApiContentId 기준).
 * 외부 API 없이도 동작하므로, mapper 출력만으로 단독 테스트할 수 있다.
 */
export async function upsertPlaces(places: PlaceData[]): Promise<PlaceUpsertResult> {
  const targets = places.filter((place) => place.tourApiContentId.length > 0);
  const skipped = places.length - targets.length;

  if (targets.length === 0) {
    return { created: 0, updated: 0, skipped, total: places.length };
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
    total: places.length,
  };
}

/** TourAPI 위치기반 조회 결과를 그대로 적재한다(fetch → map → upsert). 유효한 키 필요. */
export async function ingestTourPlacesByLocation(
  params: TourLocationListParams,
): Promise<PlaceUpsertResult> {
  const response = await fetchTourPlacesByLocation(params);
  return upsertPlaces(mapTourPlaceList(response));
}

/** TourAPI 지역기반 조회 결과를 그대로 적재한다. 유효한 키 필요. */
export async function ingestTourPlacesByArea(
  params: TourAreaListParams = {},
): Promise<PlaceUpsertResult> {
  const response = await fetchTourPlacesByArea(params);
  return upsertPlaces(mapTourPlaceList(response));
}

/** 신규 생성 시에는 목록에서 얻은 모든 필드를 넣는다. */
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
  };
}

/**
 * 갱신 시에는 목록 조회로 신뢰할 수 있는 필드만 덮어쓴다.
 * description/openingTime/closingTime/recommendedDuration 은 상세(detail) 조회나 다른 경로로
 * 채워질 수 있으므로, 목록 재적재가 이 값들을 null로 덮어쓰지 않도록 제외한다.
 */
export function toPlaceUpdateInput(place: PlaceData): Prisma.PlaceUpdateInput {
  return {
    name: place.name,
    type: place.type ?? PlaceType.TOURIST_SPOT,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    imageUrl: place.imageUrl,
  };
}
