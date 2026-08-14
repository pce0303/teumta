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
 * ⚠️ 공식 스펙 기반. 실제 응답 샘플로 요약 feature 필드를 한 번 더 검증할 것.
 */

const SERVICE = 'tmap';

/**
 * 응답의 LineString feature들을 이어붙여 보행 경로 도형으로 변환한다.
 * GeoJSON 좌표는 [경도, 위도] 순서라 {latitude, longitude}로 뒤집어 담는다.
 * 구간 경계에서 겹치는 좌표는 한 번만 남긴다.
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

/** 응답에서 요약 feature의 전체 거리(m)/시간(초)만 추출한다(분 변환은 호출부 정책에 따름). */
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

/** 응답에서 요약(totalDistance/totalTime)과 경로 도형을 찾아 한 구간의 이동 정보로 변환한다. */
export function extractRouteSummary(response: TmapRouteResponse): RouteSegmentData {
  const { distanceMeters, totalSeconds } = extractRouteTotals(response);

  return {
    travelMinutes: Math.round(totalSeconds / 60),
    distanceMeters,
    path: extractRoutePath(response),
  };
}

/** POI 검색 응답 → 목적지 검색 결과[](source=TMAP). 좌표 없는 항목은 제외. */
export function mapPoiSearchToDestinations(
  response: TmapPoiSearchResponse,
): DestinationSearchResult[] {
  const pois = response.searchPoiInfo?.pois?.poi ?? [];
  const results: DestinationSearchResult[] = [];

  for (const poi of pois) {
    const latitude = parseCoordinateOrNull(poi.noorLat ?? poi.frontLat);
    const longitude = parseCoordinateOrNull(poi.noorLon ?? poi.frontLon);
    if (latitude === null || longitude === null) {
      continue;
    }
    results.push({
      source: 'TMAP',
      tourApiContentId: null,
      tmapPoiId: String(poi.id),
      contentTypeId: null,
      name: poi.name,
      address: buildPoiAddress(poi),
      latitude,
      longitude,
      imageUrl: null,
      // TMAP POI는 tourApiContentId가 없어 내부 Place와 이을 키가 없다.
      placeId: null,
    });
  }
  return results;
}

/** POI 상세 응답 → 기준 좌표/이름. 좌표 없으면 null(호출부에서 NOT_FOUND 처리). */
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

/** 단일 출발→도착 응답을 RouteCalculationData(한 구간)로 변환한다. */
export function mapTmapRouteToRouteCalculation(response: TmapRouteResponse): RouteCalculationData {
  const segment = extractRouteSummary(response);
  return {
    totalDurationMinutes: segment.travelMinutes,
    totalDistanceMeters: segment.distanceMeters,
    segments: [segment],
  };
}
