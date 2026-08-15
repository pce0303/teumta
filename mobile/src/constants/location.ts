import { Accuracy, type LocationOptions } from 'expo-location';

/** 목적지 "도착" 판정 반경(m). 조정 편의를 위해 상수 분리. */
export const ARRIVAL_RADIUS_METERS = 50;

/**
 * 위치 조회 옵션(foreground 전용).
 *
 * 개인정보 최소화 원칙:
 *  - 위치는 단말 내부 도착 판정에만 사용, 서버 전송 없음
 *  - background 위치·추적 미사용
 */
export const LOCATION_OPTIONS: LocationOptions = {
  accuracy: Accuracy.Balanced,
  // watch 사용 시 이동 거리 기준 업데이트 — 과도한 갱신 방지
  distanceInterval: 10,
};
