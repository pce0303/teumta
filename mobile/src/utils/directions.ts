import Constants from 'expo-constants';
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';

import type { Coordinate } from '@/types/place';

export type DirectionsDestination = Coordinate & { name: string };

/**
 * 외부 지도 앱으로 목적지 길찾기 열기.
 *
 * 개인정보 최소화 원칙:
 *  - 틈타 서버로 사용자 GPS 전송 없음
 *  - **출발지 미전달** — 목적지만 넘기고 지도 앱이 자체 위치로 경로 탐색
 *    (네이버지도는 출발지 생략 시 현 위치 기본값. 카카오맵 길찾기는 출발지 필수라
 *     좌표 표시 스킴으로 대체 — 원칙을 지키기 위한 선택)
 *
 * iOS는 `LSApplicationQueriesSchemes`에 선언된 스킴만 조회 가능(app.json).
 */

/** 네이버지도는 모든 URL에 호출 앱 식별자 요구(iOS는 번들 ID). */
const APP_NAME =
  Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.teumta.teumta';

interface MapApp {
  /** 설치 여부 확인용 스킴. */
  probe: string;
  label: string;
  buildUrl: (destination: DirectionsDestination) => string;
}

/** 국내 도보 길찾기 사용 빈도 순. */
const MAP_APPS: MapApp[] = [
  {
    probe: 'nmap://',
    label: '네이버지도로 길찾기',
    buildUrl: ({ latitude, longitude, name }) =>
      `nmap://route/walk?dlat=${latitude}&dlng=${longitude}&dname=${encodeURIComponent(name)}&appname=${APP_NAME}`,
  },
  {
    probe: 'kakaomap://',
    // 카카오맵 길찾기(route)는 출발지 필수 → 목적지 표시로 대체
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

/** 설치된 앱 없을 때. 애플 지도는 목적지만으로 도보 경로 가능. */
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

/** 설치된 앱이 여럿이면 사용자 선택. */
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

/** 스킴 조회 실패는 "미설치"로 간주 — 미선언 스킴에서 예외 가능. */
async function canOpen(url: string): Promise<boolean> {
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

/** 실패 시 조용히 끝내지 않고 안내 — 버튼이 죽은 것처럼 보이는 상황 방지. */
async function openOrWarn(url: string, title = '길찾기를 열 수 없어요'): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(title, '지도 앱을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

/**
 * 네이버지도에서 장소 정보(사진·리뷰·영업시간) 열기.
 *
 * TourAPI가 로컬 장소에 주는 건 이름·주소·대표사진 정도라 "가볼지" 판단에 부족할 때가 있음.
 * 사진 여러 장과 리뷰는 기존 지도 서비스가 압도적 — 따라 만들 영역이 아님.
 * 판단은 앱 안에서 끝내고 심화 정보만 넘긴다(주 CTA는 계속 우리 길찾기).
 *
 * 좌표 핀이 아니라 검색으로 여는 이유: 핀은 마커만 찍고 장소 페이지로 안 들어감.
 * 동명 상호 회피를 위해 이름 + 주소 동시 전달.
 *
 * 개인정보: 목적지 이름·주소만 전달, 사용자 위치 미사용.
 */
export async function openNaverMapPlace(place: {
  name: string;
  address?: string | null;
}): Promise<void> {
  const query = encodeURIComponent([place.name, place.address].filter(Boolean).join(' '));
  const title = '네이버지도를 열 수 없어요';

  if (await canOpen('nmap://')) {
    await openOrWarn(`nmap://search?query=${query}&appname=${APP_NAME}`, title);
    return;
  }
  await openOrWarn(`https://map.naver.com/p/search/${query}`, title);
}
