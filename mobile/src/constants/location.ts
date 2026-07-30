import { Accuracy, type LocationOptions } from 'expo-location';

/**
 * 목적지 "도착"으로 판정하는 반경(미터). 이후 쉽게 조정 가능하도록 상수로 분리.
 */
export const ARRIVAL_RADIUS_METERS = 50;

/**
 * 위치 조회 옵션(foreground 전용).
 *
 * 개인정보 최소화 원칙:
 *  - 위치는 단말 내부에서 도착 판정에만 사용한다(서버 전송 없음).
 *  - background 위치/추적을 사용하지 않는다.
 */
export const LOCATION_OPTIONS: LocationOptions = {
  accuracy: Accuracy.Balanced,
  // watch 사용 시 이동 거리 기준 업데이트(과도한 위치 갱신 방지).
  distanceInterval: 10,
};
