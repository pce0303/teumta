import { ARRIVAL_RADIUS_METERS } from '@/constants/location';
import type { Coordinate } from '@/types/place';

import { distanceInMeters } from './distance';

/**
 * 현재 위치가 목적지 반경 이내면 "도착"으로 판정한다.
 *
 * 개인정보 최소화: 도착 판정은 단말 내부에서만 이루어진다.
 * 판정에 사용한 실제 GPS 좌표는 서버로 전송되지 않는다.
 */
export function hasArrived(
  current: Coordinate,
  destination: Coordinate,
  radiusMeters: number = ARRIVAL_RADIUS_METERS,
): boolean {
  return distanceInMeters(current, destination) <= radiusMeters;
}
