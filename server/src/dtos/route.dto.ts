/**
 * 틈타 내부 경로 계산 결과 계약.
 *
 * TMAP 등 외부 경로 API의 원본 응답과 분리된, 내부에서 사용하는 정규화된 형태다.
 * Prisma `Route`/`RouteStop`의 estimated* 필드에 적재하거나 앱 응답 구성에 사용한다.
 */

/**
 * 좌표. **오직 Place(관광지/로컬 장소)의 고정 좌표에만 사용한다.**
 * 개인정보 최소화 원칙상 사용자의 현재 GPS 좌표는 서버로 들어오지 않으며,
 * 이 타입에도 사용자 위치를 담아서는 안 된다(Place ↔ Place 경로 계산 전용).
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** 인접한 두 지점(RouteStop) 사이 구간 정보. */
export interface RouteSegmentData {
  travelMinutes: number;
  distanceMeters: number;
  /**
   * 구간 보행 경로 도형(지도 폴리라인용). `RouteStop.pathFromPrevious`에 적재한다.
   * Place ↔ Place 고정 경로의 좌표이며 사용자 위치가 아니다.
   */
  path: Coordinate[];
}

export interface RouteCalculationData {
  totalDurationMinutes: number;
  totalDistanceMeters: number;
  /** 출발 지점 다음 구간부터 순서대로. segments[i] = stop[i] -> stop[i+1]. */
  segments: RouteSegmentData[];
}
