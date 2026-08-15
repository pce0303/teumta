import type {
  Coordinate,
  DestinationSearchResult,
  RouteCalculationData,
  RouteSegmentData,
} from '../../dtos';
import { ExternalApiResponseError } from '../common';
import type { TmapPoiDetailResponse, TmapPoiSearchResponse, TmapRouteResponse } from './tmap.dto';

/**
 * TMAP 보행자 경로 원본 응답 → 틈타 내부 형태 변환.
 *
 * ⚠️ 공식 스펙 기반 — 실제 응답 샘플로 요약 feature 필드 재검증 필요.
 */

const SERVICE = 'tmap';

/**
 * LineString feature 연결 → 보행 경로 도형.
 * GeoJSON 좌표는 [경도, 위도] 순서라 {latitude, longitude}로 뒤집어 담는다.
 * 구간 경계에서 겹치는 좌표는 한 번만.
 */
export function extractRoutePath(response: TmapRouteResponse): Coordinate[] {
  const path: Coordinate[] = [];

  for (const feature of response.features ?? []) {
    if (feature.geometry?.type !== 'LineString') {
      continue;
    }
    for (const pair of feature.geometry.coordinates as number[][]) {
      const [longitude, latitude] = pair;
      const last = path[path.length - 1];
      if (last && last.latitude === latitude && last.longitude === longitude) {
        continue;
      }
      path.push({ latitude, longitude });
    }
  }

  return path;
}

/** 요약 feature의 전체 거리(m)·시간(초)만 추출. 분 변환은 호출부 정책. */
export function extractRouteTotals(
  response: TmapRouteResponse,
): { distanceMeters: number; totalSeconds: number } {
  const summary = response.features?.find(
    (feature) =>
      typeof feature.properties?.totalDistance === 'number' &&
      typeof feature.properties?.totalTime === 'number',
  );

  if (!summary) {
    throw new ExternalApiResponseError(SERVICE, 'Route summary (totalDistance/totalTime) not found');
  }

  return {
    distanceMeters: summary.properties.totalDistance as number,
    totalSeconds: summary.properties.totalTime as number,
  };
}

/** 요약(totalDistance/totalTime) + 경로 도형 → 한 구간 이동 정보. */
export function extractRouteSummary(response: TmapRouteResponse): RouteSegmentData {
  const { distanceMeters, totalSeconds } = extractRouteTotals(response);

  return {
    travelMinutes: Math.round(totalSeconds / 60),
    distanceMeters,
    path: extractRoutePath(response),
  };
}

/**
 * POI 검색 응답 → 목적지 검색 결과[](source=TMAP). 좌표 없는 항목 제외.
 *
 * **id 중복 제거:** TMAP은 같은 장소의 출입구·주차장을 별도 POI로 주면서 `id`는 공유,
 * `pkey`로만 구분("교보문고 강남점" / "…주차장" / "…정문" → 모두 id 736655).
 * `id`가 목적지 식별자(`tmapPoiId`, 혼잡도 조회 키)라 그대로 내보내면 같은 장소가 여러 번 뜨고
 * 클라이언트가 구분 불가 → 첫 항목(대표)만 유지.
 */
export function mapPoiSearchToDestinations(
  response: TmapPoiSearchResponse,
): DestinationSearchResult[] {
  const pois = response.searchPoiInfo?.pois?.poi ?? [];
  const results: DestinationSearchResult[] = [];
  const seenPoiIds = new Set<string>();

  for (const poi of pois) {
    const latitude = parseCoordinateOrNull(poi.noorLat ?? poi.frontLat);
    const longitude = parseCoordinateOrNull(poi.noorLon ?? poi.frontLon);
    if (latitude === null || longitude === null) {
      continue;
    }
    const poiId = String(poi.id);
    if (seenPoiIds.has(poiId)) {
      continue;
    }
    seenPoiIds.add(poiId);
    results.push({
      source: 'TMAP',
      tourApiContentId: null,
      tmapPoiId: poiId,
      contentTypeId: null,
      name: poi.name,
      address: buildPoiAddress(poi),
      latitude,
      longitude,
      imageUrl: null,
      // TMAP POI는 tourApiContentId 없음 → 내부 Place와 이을 키 없음
      placeId: null,
    });
  }
  return results;
}

/** POI 상세 → 기준 좌표·이름. 좌표 없으면 null(호출부에서 NOT_FOUND). */
export function extractPoiBase(
  response: TmapPoiDetailResponse,
): { latitude: number; longitude: number; name: string } | null {
  const info = response.poiDetailInfo;
  const latitude = parseCoordinateOrNull(info?.lat);
  const longitude = parseCoordinateOrNull(info?.lon);
  if (!info || latitude === null || longitude === null) {
    return null;
  }
  return { latitude, longitude, name: info.name ?? '목적지' };
}

function buildPoiAddress(poi: {
  upperAddrName?: string;
  middleAddrName?: string;
  lowerAddrName?: string;
  detailAddrName?: string;
  roadName?: string;
  firstBuildNo?: string;
}): string | null {
  const parts = [
    poi.upperAddrName,
    poi.middleAddrName,
    poi.roadName ?? poi.lowerAddrName,
    poi.roadName ? poi.firstBuildNo : poi.detailAddrName,
  ]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(' ') : null;
}

function parseCoordinateOrNull(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

/** 단일 출발→도착 응답 → RouteCalculationData(한 구간). */
export function mapTmapRouteToRouteCalculation(response: TmapRouteResponse): RouteCalculationData {
  const segment = extractRouteSummary(response);
  return {
    totalDurationMinutes: segment.travelMinutes,
    totalDistanceMeters: segment.distanceMeters,
    segments: [segment],
  };
}
