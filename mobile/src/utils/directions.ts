import { Alert, Linking, Platform } from 'react-native';

import type { Coordinate } from '@/types/place';

export type DirectionsDestination = Coordinate & { name: string };

/**
 * 외부 지도 앱으로 "목적지" 길찾기를 연다.
 *
 * 개인정보 최소화 원칙:
 *  - 틈타 서버로 사용자 현재 GPS를 보내지 않는다(user GPS → backend → 지도 금지).
 *  - 출발지(origin)를 지정하지 않는다 → 외부 지도 앱이 자체적으로 사용자 위치를 사용해 길찾기.
 *  - 넘기는 값은 목적지(name / latitude / longitude)뿐이다.
 *
 * iOS는 다른 앱의 URL 스킴을 조회하려면 Info.plist의 LSApplicationQueriesSchemes에
 * 선언돼 있어야 한다(app.json ios.infoPlist에 'tmap' 등록). 선언이 없거나 조회가 막히면
 * canOpenURL이 false를 주거나 예외를 던지므로, 어느 쪽이든 지도 웹 주소로 넘어가게 한다.
 */
export async function openDirections(destination: DirectionsDestination): Promise<void> {
  const { latitude, longitude, name } = destination;

  const tmapUrl = `tmap://route?goalname=${encodeURIComponent(name)}&goalx=${longitude}&goaly=${latitude}`;
  const fallbackUrl = Platform.select({
    ios: `https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=w`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`,
  }) as string;

  if (await canOpen(tmapUrl)) {
    if (await tryOpen(tmapUrl)) {
      return;
    }
  }

  if (await tryOpen(fallbackUrl)) {
    return;
  }

  // 두 경로 모두 실패하면 조용히 끝내지 않고 알린다(원인을 모른 채 버튼이 죽어 보이는 것을 막는다).
  Alert.alert('길찾기를 열 수 없어요', '지도 앱을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
}

/** 스킴 조회 실패는 "열 수 없음"으로 본다. iOS 스킴 미선언 시 예외가 날 수 있다. */
async function canOpen(url: string): Promise<boolean> {
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
