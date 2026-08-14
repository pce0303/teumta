/**
 * 좌표 거리 계산.
 *
 * ⚠️ privacy: **Place(관광지/로컬 장소)의 고정 좌표에만 사용한다.**
 * 사용자의 현재 GPS는 서버로 들어오지 않으며 이 함수에도 넘기지 않는다
 * (사용자 위치 기반 거리 계산은 단말 내부에서 수행한다 — location-privacy.md).
 */

const EARTH_RADIUS_METERS = 6_371_000;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 두 고정 좌표 사이의 대권 거리(m, 반올림). */
export function distanceMeters(from: GeoPoint, to: GeoPoint): number {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(
    EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)),
  );
}
