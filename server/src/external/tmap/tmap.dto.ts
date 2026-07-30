/**
 * TMAP 경로/이동시간 API 원본 응답 타입.
 *
 * ⚠️ 아직 공식 스펙/실제 응답 샘플을 확인하지 않았다. 실제 필드를 추측하지 않는다.
 *
 * TODO: 공식 스펙 확인 후 실제 필드로 대체. (예상 후보)
 *   - features[]: 경로 지오메트리, properties.totalDistance, properties.totalTime 등
 */

/** TMAP 경로 계산 응답(원본 전체). */
export type TmapRouteResponse = Record<string, unknown>;
