import type { RouteDetail, RouteSummary } from '../types/route';
import { apiRequest } from './client';

/**
 * GET /api/places/:placeId/routes — 해당 장소를 mainPlace로 하는 코스 목록.
 * 전체 코스를 한 번에 조회하는 엔드포인트는 아직 없어 관광지 단위로만 조회한다(api-spec §6.5 논의 중).
 */
export function fetchRoutesByPlace(placeId: number): Promise<RouteSummary[]> {
  return apiRequest<RouteSummary[]>(`/places/${placeId}/routes`);
}

/** GET /api/routes/:routeId — stops(stopOrder 오름차순, 장소 정보 포함). */
export function fetchRoute(routeId: number): Promise<RouteDetail> {
  return apiRequest<RouteDetail>(`/routes/${routeId}`);
}
