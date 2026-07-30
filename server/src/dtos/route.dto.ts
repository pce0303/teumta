/**
 * 틈타 내부 경로 계산 결과 계약.
 *
 * TMAP 등 외부 경로 API의 원본 응답과 분리된, 내부에서 사용하는 정규화된 형태다.
 * Prisma `Route`/`RouteStop`의 estimated* 필드에 적재하거나 앱 응답 구성에 사용한다.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** 인접한 두 지점(RouteStop) 사이 구간 정보. */
export interface RouteSegmentData {
  travelMinutes: number;
  distanceMeters: number;
}

export interface RouteCalculationData {
  totalDurationMinutes: number;
  totalDistanceMeters: number;
  /** 출발 지점 다음 구간부터 순서대로. segments[i] = stop[i] -> stop[i+1]. */
  segments: RouteSegmentData[];
}
