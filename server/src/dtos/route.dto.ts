/**
 * 내부 경로 계산 결과 계약.
 *
 * 외부 경로 API 원본 응답과 분리된 정규화 형태.
 * `Route`/`RouteStop`의 estimated* 필드 적재 또는 앱 응답 구성에 사용.
 */

/**
 * 좌표. **Place(관광지·로컬 장소) 고정 좌표 전용.**
 * 개인정보 최소화 원칙상 사용자 GPS는 서버로 들어오지 않으며 이 타입에도 담지 않는다
 * — Place ↔ Place 경로 계산 전용.
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
   * 구간 보행 경로 도형(지도 폴리라인용) → `RouteStop.pathFromPrevious` 적재.
   * Place ↔ Place 고정 경로 좌표, 사용자 위치 아님.
   */
  path: Coordinate[];
}

export interface RouteCalculationData {
  totalDurationMinutes: number;
  totalDistanceMeters: number;
  /** 출발 다음 구간부터 순서대로. segments[i] = stop[i] → stop[i+1]. */
  segments: RouteSegmentData[];
}
