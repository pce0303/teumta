import type { RouteCalculationData } from '../../dtos';
import type { TmapRouteResponse } from './tmap.dto';

/**
 * TMAP 경로 원본 응답 → 틈타 내부 RouteCalculationData 변환.
 *
 * 향후 역할: 장소 간 경로 계산 결과에서 총 이동시간/거리 및 구간별 값을 정규화한다.
 *
 * TODO(실제 연동 시):
 *  - totalTime(초) → totalDurationMinutes(분)
 *  - totalDistance(m) → totalDistanceMeters
 *  - 구간별 travelMinutes / distanceMeters 추출(RouteStop 순서 대응)
 */
export function mapTmapRouteToRouteCalculation(_raw: TmapRouteResponse): RouteCalculationData {
  // TODO: 실제 변환 구현. 지금은 skeleton이므로 호출 시 즉시 실패시킨다.
  throw new Error('mapTmapRouteToRouteCalculation is not implemented yet');
}
