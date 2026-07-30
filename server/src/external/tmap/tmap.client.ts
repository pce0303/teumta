import { ExternalApiError } from '../common';
// import { externalConfig, requestJson } from '../common';
import type { Coordinate } from '../../dtos';
import type { TmapRouteResponse } from './tmap.dto';

/**
 * TMAP 경로/이동시간 API 클라이언트. 통신 책임만 가진다.
 *
 * ⚠️ 이번 작업 범위에서는 실제 호출을 하지 않는다(skeleton + TODO).
 */

/** 경로 계산 파라미터. RouteStop 좌표 순서를 그대로 전달할 수 있게 waypoints로 둔다. */
export interface TmapRouteParams {
  waypoints: Coordinate[];
  // TODO: 이동수단(보행/자동차 등), 옵션 등 공식 스펙 확인 후 확정
}

/**
 * 지점들(RouteStop 좌표) 사이의 경로/이동시간 계산.
 * TODO(실제 연동 시): externalConfig.tmap + requestJson 사용.
 */
export async function fetchTmapRoute(_params: TmapRouteParams): Promise<TmapRouteResponse> {
  throw new ExternalApiError('tmap', 'TMAP client is not implemented yet', {
    code: 'NOT_IMPLEMENTED',
  });
}
