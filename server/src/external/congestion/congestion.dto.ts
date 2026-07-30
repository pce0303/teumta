/**
 * SK 실시간 혼잡도 API 원본 응답 타입.
 *
 * ⚠️ 아직 공식 스펙/실제 응답 샘플을 확인하지 않았다. 실제 필드를 추측하지 않는다.
 *
 * TODO: 공식 스펙 확인 후 실제 필드로 대체. (예상 후보)
 *   - 장소 식별자, 혼잡도 등급/레벨 문자열, 혼잡도 지수, 측정 시각 등
 */

/** SK 혼잡도 조회 응답(원본 전체). */
export type SkCongestionResponse = Record<string, unknown>;
