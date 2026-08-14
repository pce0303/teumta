import type { Place } from './place';

/**
 * GET /api/places/:placeId/routes 응답 항목.
 * server/src/services/route.service.ts getRoutesByPlaceId 기준 —
 * 목록 응답에는 stops가 포함되지 않는다(정류지 수는 상세에서만 확인 가능).
 */
export interface RouteSummary {
  id: number;
  name: string;
  mainPlaceId: number;
  description: string | null;
  estimatedTotalDurationMinutes: number | null;
  estimatedTotalDistanceMeters: number | null;
  createdAt: string;
  updatedAt: string;
}

/** RouteStop.pathFromPrevious 좌표. Place↔Place 고정 경로이며 사용자 GPS가 아니다. */
export interface RoutePathPoint {
  latitude: number;
  longitude: number;
}

/** GET /api/routes/:routeId 의 stops 항목(stopOrder 오름차순). */
export interface RouteStop {
  id: number;
  routeId: number;
  placeId: number;
  stopOrder: number;
  stayMinutes: number | null;
  /** 이전 정류지(첫 정류지는 mainPlace)에서 여기까지의 값. */
  estimatedTravelMinutesFromPrevious: number | null;
  estimatedDistanceMetersFromPrevious: number | null;
  pathFromPrevious: RoutePathPoint[] | null;
  place: Place;
}

/** GET /api/routes/:routeId 응답. */
export interface RouteDetail extends RouteSummary {
  stops: RouteStop[];
}
