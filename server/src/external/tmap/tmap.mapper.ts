import type { RouteCalculationData, RouteSegmentData } from '../../dtos';
import { ExternalApiResponseError } from '../common';
import type { TmapRouteResponse } from './tmap.dto';

/**
 * TMAP 보행자 경로 원본 응답 → 틈타 내부 형태 변환.
 *
 * ⚠️ 공식 스펙 기반. 실제 응답 샘플로 요약 feature 필드를 한 번 더 검증할 것.
 */

const SERVICE = 'tmap';

/** 응답에서 요약(totalDistance/totalTime)을 찾아 한 구간의 이동 정보로 변환한다. */
export function extractRouteSummary(response: TmapRouteResponse): RouteSegmentData {
  const summary = response.features?.find(
    (feature) =>
      typeof feature.properties?.totalDistance === 'number' &&
      typeof feature.properties?.totalTime === 'number',
  );

  if (!summary) {
    throw new ExternalApiResponseError(SERVICE, 'Route summary (totalDistance/totalTime) not found');
  }

  const distanceMeters = summary.properties.totalDistance as number;
  const totalSeconds = summary.properties.totalTime as number;

  return {
    travelMinutes: Math.round(totalSeconds / 60),
    distanceMeters,
  };
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
