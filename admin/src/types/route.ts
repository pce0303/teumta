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
  /** 마지막 정류지 → 기준 관광지 복귀 구간. null이면 복귀 미포함 코스. */
  returnTravelMinutes: number | null;
  returnDistanceMeters: number | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/admin/routes 응답 항목(목록 표시용 필드 2개 추가). */
export interface RouteListItem extends RouteSummary {
  mainPlaceName: string;
  stopCount: number;
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
  returnPath: RoutePathPoint[] | null;
  stops: RouteStop[];
}

/**
 * POST /api/admin/routes 요청 본문.
 * 이동시간·거리·경로는 보내지 않는다 — 서버가 TMAP으로 계산해 채운다(api-spec §6.5).
 */
export interface CreateRouteInput {
  name: string;
  mainPlaceId: number;
  description?: string | null;
  /** 마지막 정류지에서 기준 관광지로 돌아오는 구간 계산 여부. 서버 기본값 true. */
  includeReturn?: boolean;
  stops: { placeId: number; stayMinutes: number }[];
}

/** PATCH /api/admin/routes/:id 요청 본문. stops를 보내면 전체 교체 + 재계산. */
export type UpdateRouteInput = Partial<CreateRouteInput>;
