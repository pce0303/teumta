import type { Coordinate, RouteCalculationData, RouteSegmentData } from '../dtos';
import { extractRouteSummary, fetchPedestrianRoute } from '../external/tmap';

/**
 * TMAP 기반 경로·이동시간 계산.
 *
 * 역할 경계: B가 "좌표 → 이동시간·거리"를 서비스 함수로 제공, A가 Route/RouteStop 조립에 사용.
 * B는 Route 스키마에 의존하지 않는다(좌표 in / DTO out).
 *
 * ⚠️ 개인정보 최소화: 입력은 **Place ↔ Place 고정 좌표만**.
 *    사용자 GPS 전달 금지(user GPS → backend → TMAP 금지).
 *
 * 컨트롤러는 TMAP을 직접 호출하지 않고 이 서비스만 사용.
 */

/** 두 지점 사이 보행 이동시간·거리(한 구간). */
export async function getTravelTime(from: Coordinate, to: Coordinate): Promise<RouteSegmentData> {
  const response = await fetchPedestrianRoute({ start: from, end: to });
  return extractRouteSummary(response);
}

/**
 * 경유지 목록을 인접 구간별로 계산 후 합산.
 * 인접 쌍마다 TMAP 호출 → waypoints.length - 1회. 순차 호출로 rate limit 보호.
 */
export async function calculateWalkingRoute(
  waypoints: Coordinate[],
): Promise<RouteCalculationData> {
  if (waypoints.length < 2) {
    throw new Error('calculateWalkingRoute requires at least two waypoints');
  }

  const segments: RouteSegmentData[] = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- 순차 호출로 rate limit 보호
    segments.push(await getTravelTime(waypoints[i], waypoints[i + 1]));
  }

  return {
    totalDurationMinutes: segments.reduce((sum, segment) => sum + segment.travelMinutes, 0),
    totalDistanceMeters: segments.reduce((sum, segment) => sum + segment.distanceMeters, 0),
    segments,
  };
}
