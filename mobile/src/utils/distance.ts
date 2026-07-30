import type { Coordinate } from '@/types/place';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * 두 좌표 사이의 거리(Haversine, 미터).
 *
 * 개인정보 최소화: 이 계산은 전적으로 단말 내부에서 수행된다.
 * 사용자 현재 위치와 Place 좌표의 거리 계산에 쓰이며, 어떤 좌표도 서버로 전송하지 않는다.
 */
export function distanceInMeters(from: Coordinate, to: Coordinate): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}
