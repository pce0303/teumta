import { PlaceType } from '@prisma/client';

import type { NearbyLocalPlaceCandidate, NearbyLocalPlaceDto } from '../dtos';
import { ExternalApiError } from '../external/common';
import { extractRouteTotals, fetchPedestrianRoute } from '../external/tmap';
import {
  extractDetailCoordinate,
  extractDetailItem,
  fetchTourPlaceDetail,
  fetchTourPlacesByLocation,
  mapNearbyCandidateList,
} from '../external/tour';
import { prisma } from '../utils/prisma';

/**
 * 주변 로컬 장소 실시간 조회(TourAPI + TMAP). 공모전 기준상 관광정보는 DB에 저장하지 않으며,
 * prisma는 기준 관광지 읽기(findUnique)에만 사용한다. 실패 정책은 docs/api-spec.md §3.3b 참조.
 */

export const DEFAULT_RADIUS_METERS = 2000;
export const MAX_RADIUS_METERS = 20_000;
/** TMAP 호출량 제한: TourAPI 후보 중 가까운 순 최대 이 개수만 TMAP을 호출한다. */
export const MAX_TOUR_CANDIDATES = 10;
/** TMAP 동시 호출 제한. */
export const TMAP_CONCURRENCY = 3;

/** 로컬 장소 후보로 볼 TourAPI contentTypeId. 14=문화시설, 38=쇼핑, 39=음식점. */
const LOCAL_CANDIDATE_CONTENT_TYPE_IDS = ['14', '38', '39'] as const;

const NUM_OF_ROWS_PER_TYPE = 20;

export type NearbyLocalPlacesResult =
  | { status: 'NOT_FOUND' }
  | { status: 'NOT_TOURIST_SPOT' }
  | { status: 'NO_TOUR_CONTENT_ID' }
  | { status: 'SUCCESS'; places: NearbyLocalPlaceDto[] };

/**
 * 사용자가 검색으로 결정한 목적지(TourAPI contentId) 기준 주변 로컬 장소 조회.
 * DB를 전혀 사용하지 않는다. contentId 상세 조회가 실패하거나 좌표가 없으면 NOT_FOUND.
 */
export async function getNearbyLocalPlacesByContentId(
  contentId: string,
  radiusMeters: number = DEFAULT_RADIUS_METERS,
): Promise<NearbyLocalPlacesResult> {
  const detail = await fetchTourPlaceDetail(contentId);
  const coordinate = extractDetailCoordinate(detail);
  if (!coordinate) {
    return { status: 'NOT_FOUND' };
  }
  const name = extractDetailItem(detail)?.title ?? '목적지';

  const places = await findNearbyLocalPlaces({ ...coordinate, name, contentId }, radiusMeters);
  return { status: 'SUCCESS', places };
}

/** 내부 DB 관광지(Place id) 기준 주변 로컬 장소 조회. 기준 확인에만 DB를 읽는다. */
export async function getNearbyLocalPlacesRealtime(
  touristSpotId: number,
  radiusMeters: number = DEFAULT_RADIUS_METERS,
): Promise<NearbyLocalPlacesResult> {
  const touristSpot = await prisma.place.findUnique({
    where: { id: touristSpotId },
    select: {
      id: true,
      name: true,
      type: true,
      latitude: true,
      longitude: true,
      tourApiContentId: true,
    },
  });

  if (!touristSpot) {
    return { status: 'NOT_FOUND' };
  }
  if (touristSpot.type !== PlaceType.TOURIST_SPOT) {
    return { status: 'NOT_TOURIST_SPOT' };
  }
  if (!touristSpot.tourApiContentId) {
    return { status: 'NO_TOUR_CONTENT_ID' };
  }

  const base = await resolveBaseCoordinate(touristSpot.tourApiContentId, {
    latitude: Number(touristSpot.latitude),
    longitude: Number(touristSpot.longitude),
  });

  const places = await findNearbyLocalPlaces(
    { ...base, name: touristSpot.name, contentId: touristSpot.tourApiContentId },
    radiusMeters,
  );
  return { status: 'SUCCESS', places };
}

/** 공용 코어: 기준 좌표 → 후보 수집 → 선별 → TMAP 보행거리 → 필터·정렬. */
async function findNearbyLocalPlaces(
  base: { latitude: number; longitude: number; name: string; contentId: string },
  radiusMeters: number,
): Promise<NearbyLocalPlaceDto[]> {
  const candidates = await fetchNearbyCandidates(base, radiusMeters, base.contentId);
  if (candidates.length === 0) {
    return [];
  }
  const selected = selectClosestCandidates(candidates, base, MAX_TOUR_CANDIDATES);
  return resolveWalkingDistances(base, selected, radiusMeters);
}

/** 기준 좌표는 detailCommon2 실시간 조회 우선, 실패·누락 시에만 DB 좌표 fallback. */
async function resolveBaseCoordinate(
  tourApiContentId: string,
  fallback: { latitude: number; longitude: number },
): Promise<{ latitude: number; longitude: number }> {
  try {
    const detail = await fetchTourPlaceDetail(tourApiContentId);
    return extractDetailCoordinate(detail) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * contentTypeId별 locationBasedList2 결과 병합(중복·자기 자신 제외).
 * 일부 타입만 실패하면 성공분으로 진행, 전부 실패하면 첫 오류를 던진다.
 */
async function fetchNearbyCandidates(
  base: { latitude: number; longitude: number },
  radiusMeters: number,
  baseContentId: string,
): Promise<NearbyLocalPlaceCandidate[]> {
  const results = await Promise.allSettled(
    LOCAL_CANDIDATE_CONTENT_TYPE_IDS.map((contentTypeId) =>
      fetchTourPlacesByLocation({
        mapX: base.longitude,
        mapY: base.latitude,
        radius: radiusMeters,
        contentTypeId,
        numOfRows: NUM_OF_ROWS_PER_TYPE,
        arrange: 'E',
      }),
    ),
  );

  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchTourPlacesByLocation>>> =>
      result.status === 'fulfilled',
  );
  if (fulfilled.length === 0) {
    const firstRejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    throw firstRejected?.reason ?? new ExternalApiError('tour', 'TourAPI request failed');
  }

  const seen = new Set<string>();
  const candidates: NearbyLocalPlaceCandidate[] = [];
  for (const result of fulfilled) {
    for (const candidate of mapNearbyCandidateList(result.value)) {
      if (candidate.tourApiContentId === baseContentId) {
        continue;
      }
      if (seen.has(candidate.tourApiContentId)) {
        continue;
      }
      seen.add(candidate.tourApiContentId);
      candidates.push(candidate);
    }
  }
  return candidates;
}

/** TMAP 호출량 제한용 선별. dist(없으면 하버사인)는 선별에만 쓰고 응답에 노출하지 않는다. */
export function selectClosestCandidates(
  candidates: NearbyLocalPlaceCandidate[],
  base: { latitude: number; longitude: number },
  limit: number,
): NearbyLocalPlaceCandidate[] {
  return [...candidates]
    .map((candidate) => ({
      candidate,
      screeningDistance:
        candidate.tourDistanceMeters ??
        haversineMeters(base.latitude, base.longitude, candidate.latitude, candidate.longitude),
    }))
    .sort((a, b) => a.screeningDistance - b.screeningDistance)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/** 후보별 TMAP 보행거리 계산. 일부 실패는 해당 후보 제외, 전부 실패는 오류. */
async function resolveWalkingDistances(
  base: { latitude: number; longitude: number; name: string },
  candidates: NearbyLocalPlaceCandidate[],
  radiusMeters: number,
): Promise<NearbyLocalPlaceDto[]> {
  const settled = await mapWithConcurrency(candidates, TMAP_CONCURRENCY, async (candidate) => {
    const route = await fetchPedestrianRoute({
      start: { latitude: base.latitude, longitude: base.longitude },
      end: { latitude: candidate.latitude, longitude: candidate.longitude },
      startName: base.name,
      endName: candidate.name,
    });
    const { distanceMeters, totalSeconds } = extractRouteTotals(route);
    return toNearbyLocalPlaceDto(candidate, distanceMeters, totalSeconds);
  });

  const succeeded = settled.filter((entry): entry is NearbyLocalPlaceDto => entry !== null);
  if (succeeded.length === 0 && candidates.length > 0) {
    throw new ExternalApiError('tmap', 'All TMAP pedestrian route requests failed', {
      code: 'EXTERNAL_API_UNAVAILABLE',
    });
  }

  return succeeded
    .filter((place) => place.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** 응답 DTO 변환. tourApiContentId는 정책상 미노출. */
export function toNearbyLocalPlaceDto(
  candidate: NearbyLocalPlaceCandidate,
  distanceMeters: number,
  totalSeconds: number,
): NearbyLocalPlaceDto {
  return {
    name: candidate.name,
    address: candidate.address,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    imageUrl: candidate.imageUrl,
    distanceMeters,
    travelTimeMinutes: Math.ceil(totalSeconds / 60),
  };
}

/** worker 방식 동시 실행 제한. 실패 항목은 null. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await task(items[index]);
      } catch {
        results[index] = null;
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

const EARTH_RADIUS_METERS = 6_371_000;

/** 하버사인 직선거리(m). 선별용 전용 — distanceMeters로 노출 금지. */
function haversineMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(latitude2 - latitude1);
  const dLon = toRadians(longitude2 - longitude1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
