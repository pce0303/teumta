import { Linking, Platform } from 'react-native';

import type { Coordinate } from '@/types/place';

export type DirectionsDestination = Coordinate & { name: string };

/**
 * 외부 지도 앱으로 "목적지" 길찾기를 연다.
 *
 * 개인정보 최소화 원칙:
 *  - 틈타 서버로 사용자 현재 GPS를 보내지 않는다(user GPS → backend → 지도 금지).
 *  - 출발지(origin)를 지정하지 않는다 → 외부 지도 앱이 자체적으로 사용자 위치를 사용해 길찾기.
 *  - 넘기는 값은 목적지(name / latitude / longitude)뿐이다.
 */
export async function openDirections(destination: DirectionsDestination): Promise<void> {
  const { latitude, longitude, name } = destination;

  // TMAP 앱이 설치돼 있으면 TMAP으로, 아니면 OS 기본 지도로 폴백. 모두 출발지 미지정.
  const tmapUrl = `tmap://route?goalname=${encodeURIComponent(name)}&goalx=${longitude}&goaly=${latitude}`;
  const fallbackUrl = Platform.select({
    ios: `https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=w`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`,
  });

  const canOpenTmap = await Linking.canOpenURL(tmapUrl);
  await Linking.openURL(canOpenTmap ? tmapUrl : fallbackUrl);
}
