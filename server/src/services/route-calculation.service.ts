import type { Coordinate, RouteCalculationData, RouteSegmentData } from '../dtos';
import { extractRouteSummary, fetchPedestrianRoute } from '../external/tmap';

/**
 * TMAP 기반 경로/이동시간 계산 서비스.
 *
 * 역할 경계(협업 규칙):
 *  - B(외부 연동)가 "좌표 → 이동시간/거리" 계산을 서비스 함수로 제공한다.
 *  - A(도메인)는 이 결과를 받아 Route/RouteStop 조립에 사용한다(Route 테이블 쓰기는 A).
 *    → B는 Route 스키마에 의존하지 않는다(좌표 in / DTO out).
 *
 * controller에서 TMAP을 직접 호출하지 않고 이 서비스를 통해서만 사용한다.
 */

/** 두 지점 사이 보행 이동시간/거리(한 구간). */
export async function getTravelTime(from: Coordinate, to: Coordinate): Promise<RouteSegmentData> {
  const response = await fetchPedestrianRoute({ start: from, end: to });
  return extractRouteSummary(response);
}

/**
 * 여러 경유지(RouteStop 좌표 순서)를 인접 구간별로 계산해 합산한다.
 * 인접 쌍마다 TMAP을 호출하므로 waypoints.length - 1 회 호출된다(순차 호출, rate limit 보호).
 */
export async function calculateWalkingRoute(
  waypoints: Coordinate[],
): Promise<RouteCalculationData> {
  if (waypoints.length < 2) {
    throw new Error('calculateWalkingRoute requires at least two waypoints');
  }

  const segments: RouteSegmentData[] = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- 순차 호출로 rate limit을 보호한다.
    segments.push(await getTravelTime(waypoints[i], waypoints[i + 1]));
  }

  return {
    totalDurationMinutes: segments.reduce((sum, segment) => sum + segment.travelMinutes, 0),
    totalDistanceMeters: segments.reduce((sum, segment) => sum + segment.distanceMeters, 0),
    segments,
  };
}
