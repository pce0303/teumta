import Constants from 'expo-constants';
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';

import type { Coordinate } from '@/types/place';

export type DirectionsDestination = Coordinate & { name: string };

/**
 * 외부 지도 앱으로 목적지 길찾기를 연다.
 *
 * 개인정보 최소화 원칙:
 *  - 틈타 서버로 사용자 현재 GPS를 보내지 않는다.
 *  - **출발지를 넘기지 않는다.** 목적지만 전달하고 지도 앱이 자체 위치로 길을 찾는다.
 *    (네이버지도는 출발지 생략 시 현 위치를 기본값으로 쓴다. 카카오맵 길찾기는 출발지가
 *     필수라서, 대신 좌표를 지도에 표시하는 스킴으로 연다 — 원칙을 지키기 위한 선택이다.)
 *
 * iOS는 `LSApplicationQueriesSchemes`에 선언된 스킴만 조회할 수 있다(app.json 참조).
 */

/** 네이버지도는 모든 URL에 호출 앱 식별자를 요구한다(iOS는 번들 ID). */
const APP_NAME =
  Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.teumta.teumta';

interface MapApp {
  /** 설치 여부 확인용 스킴. */
  probe: string;
  label: string;
  buildUrl: (destination: DirectionsDestination) => string;
}

/** 한국에서 도보 길찾기에 실제로 많이 쓰는 순서대로. */
const MAP_APPS: MapApp[] = [
  {
    probe: 'nmap://',
    label: '네이버지도로 길찾기',
    buildUrl: ({ latitude, longitude, name }) =>
      `nmap://route/walk?dlat=${latitude}&dlng=${longitude}&dname=${encodeURIComponent(name)}&appname=${APP_NAME}`,
  },
  {
    probe: 'kakaomap://',
    // 카카오맵 길찾기(route)는 출발지가 필수라 목적지 표시로 연다.
    label: '카카오맵에서 위치 보기',
    buildUrl: ({ latitude, longitude }) => `kakaomap://look?p=${latitude},${longitude}`,
  },
  {
    probe: 'tmap://',
    label: 'TMAP으로 길찾기',
    buildUrl: ({ latitude, longitude, name }) =>
      `tmap://route?goalname=${encodeURIComponent(name)}&goalx=${longitude}&goaly=${latitude}`,
  },
];

/** 설치된 앱이 없을 때. 애플 지도는 목적지만으로 도보 경로가 열린다. */
function webFallbackUrl({ latitude, longitude }: DirectionsDestination): string {
  return Platform.select({
    ios: `https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=w`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`,
  }) as string;
}

export async function openDirections(destination: DirectionsDestination): Promise<void> {
  const installed: MapApp[] = [];
  for (const app of MAP_APPS) {
    if (await canOpen(app.probe)) {
      installed.push(app);
    }
  }

  if (installed.length === 0) {
    await openOrWarn(webFallbackUrl(destination));
    return;
  }

  if (installed.length === 1) {
    await openOrWarn(installed[0].buildUrl(destination));
    return;
  }

  chooseApp(installed, destination);
}

/** 설치된 앱이 여럿이면 사용자가 고르게 한다. */
function chooseApp(apps: MapApp[], destination: DirectionsDestination): void {
  const labels = apps.map((app) => app.label);

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: destination.name,
        options: [...labels, '취소'],
        cancelButtonIndex: labels.length,
      },
      (index) => {
        if (index < labels.length) {
          void openOrWarn(apps[index].buildUrl(destination));
        }
      },
    );
    return;
  }

  Alert.alert(
    '길찾기 열기',
    destination.name,
    [
      ...apps.map((app) => ({
        text: app.label,
        onPress: () => {
          void openOrWarn(app.buildUrl(destination));
        },
      })),
      { text: '취소', style: 'cancel' as const },
    ],
  );
}

/** 스킴 조회 실패는 "설치되지 않음"으로 본다(미선언 스킴에서 예외가 날 수 있다). */
async function canOpen(url: string): Promise<boolean> {
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

/** 열지 못하면 조용히 끝내지 않고 알린다 — 버튼이 죽은 것처럼 보이는 상황을 막는다. */
async function openOrWarn(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('길찾기를 열 수 없어요', '지도 앱을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}
