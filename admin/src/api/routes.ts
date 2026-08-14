import type {
  CreateRouteInput,
  RouteDetail,
  RouteListItem,
  RouteSummary,
  UpdateRouteInput,
} from '../types/route';
import { apiRequest } from './client';

/** GET /api/admin/routes — 전체 코스 목록(기준 관광지명·정류지 수 포함). */
export function fetchAllRoutes(mainPlaceId?: number): Promise<RouteListItem[]> {
  const query = mainPlaceId === undefined ? '' : `?mainPlaceId=${mainPlaceId}`;
  return apiRequest<RouteListItem[]>(`/admin/routes${query}`);
}

/** GET /api/places/:placeId/routes — 해당 장소를 mainPlace로 하는 코스 목록(공개). */
export function fetchRoutesByPlace(placeId: number): Promise<RouteSummary[]> {
  return apiRequest<RouteSummary[]>(`/places/${placeId}/routes`);
}

/** GET /api/routes/:routeId — stops(stopOrder 오름차순, 장소 정보 포함). */
export function fetchRoute(routeId: number): Promise<RouteDetail> {
  return apiRequest<RouteDetail>(`/routes/${routeId}`);
}

/**
 * POST /api/admin/routes — 코스 생성.
 * 서버가 TMAP으로 구간을 계산하므로 정류지 수 + 1(복귀)만큼 외부 호출이 발생한다.
 */
export function createRoute(input: CreateRouteInput): Promise<RouteDetail> {
  return apiRequest<RouteDetail>('/admin/routes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** PATCH /api/admin/routes/:id — stops를 전달하면 전체 교체되고 경로가 재계산된다. */
export function updateRoute(
  id: number,
  input: UpdateRouteInput,
): Promise<RouteDetail> {
  return apiRequest<RouteDetail>(`/admin/routes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** DELETE /api/admin/routes/:id — 방문(Trip) 기록이 있으면 409(ROUTE_IN_USE). */
export function deleteRoute(id: number): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/admin/routes/${id}`, {
    method: 'DELETE',
  });
}
