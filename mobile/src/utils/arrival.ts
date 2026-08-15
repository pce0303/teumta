import { ARRIVAL_RADIUS_METERS } from '@/constants/location';
import type { Coordinate } from '@/types/place';

import { distanceInMeters } from './distance';

/**
 * 현재 위치가 목적지 반경 이내면 "도착".
 *
 * 개인정보 최소화: 판정은 단말 내부 전용, 사용한 GPS 좌표는 서버 미전송.
 */
export function hasArrived(
  current: Coordinate,
  destination: Coordinate,
  radiusMeters: number = ARRIVAL_RADIUS_METERS,
): boolean {
  return distanceInMeters(current, destination) <= radiusMeters;
}
