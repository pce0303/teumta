import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CourseMapView } from '@/components/course-map-view';
import { REALTIME_LEVEL_LABEL } from '@/constants/congestion';
import { Teumta } from '@/constants/theme';
import { useCourseLog } from '@/hooks/use-course-log';
import { useCourseProgress, type CourseStop } from '@/hooks/use-course-progress';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { getRealtimeCongestion } from '@/api/places';
import { getSelectedCourse } from '@/stores/selected-course';
import type { RealtimeCongestion } from '@/types/place';
import { openDirections } from '@/utils/directions';
import { distanceInMeters } from '@/utils/distance';
import { withRoJosa } from '@/utils/text';
import { timeLabelAfter } from '@/utils/time';

const SHEET_OVERLAP = 26;
const WALK_METERS_PER_MINUTE = 67;

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
}


export default function TripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selected = getSelectedCourse();
  const course = selected?.course;
  const destination = selected?.destination;

  // 도착 판정 대상: 정류지들 + 마지막 목적지(복귀)
  const courseStops: CourseStop[] =
    course && destination
      ? [
          ...course.stops.map((stop, index) => ({
            id: `stop-${index}`,
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
          })),
          {
            id: 'return',
            name: destination.name,
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        ]
      : [];

  const [congestion, setCongestion] = useState<RealtimeCongestion | null>(null);

  const { location, status, start: startLocation } = useCurrentLocation({ watch: true });
  const { phase, currentIndex, nextStop, start, updateWithLocation } =
    useCourseProgress(courseStops);
  const { markCourseCompleted } = useCourseLog();
  // 완료 기록은 코스당 1회 — 기록이 상태를 바꾸고 상태가 다시 기록을 부르는 순환 방지.
  const completionLogged = useRef(false);

  useEffect(() => {
    // 마지막 복귀 지점 도착 판정이 나면 "다녀온 코스"로 기기에만 남긴다.
    if (phase === 'completed' && selected && !completionLogged.current) {
      completionLogged.current = true;
      markCourseCompleted(selected, true);
    }
  }, [phase, selected, markCourseCompleted]);

  useEffect(() => {
    start();
    startLocation();
  }, [start, startLocation]);

  useEffect(() => {
    if (location) {
      updateWithLocation(location);
    }
  }, [location, updateWithLocation]);

  const destinationParams = selected?.destinationParams;
  useEffect(() => {
    if (!destinationParams) {
      return;
    }
    let ignored = false;

    // 복귀 판단용 목적지 혼잡도. 진입 시 1회만(서버 5분 캐시)
    getRealtimeCongestion(destinationParams)
      .then((data) => {
        if (!ignored) {
          setCongestion(data);
        }
      })
      .catch(() => {
        // 혼잡도 조회 실패해도 코스 진행은 계속
      });

    return () => {
      ignored = true;
    };
  }, [destinationParams]);

  if (!course || !destination) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>진행 중인 코스가 없습니다.</Text>
        <Pressable style={styles.emptyButton} onPress={() => router.back()}>
          <Text style={styles.emptyButtonLabel}>코스 고르러 가기</Text>
        </Pressable>
      </View>
    );
  }

  const completed = phase === 'completed';
  const distanceToNext =
    location && nextStop ? distanceInMeters(location, nextStop) : null;
  const walkMinutes =
    distanceToNext !== null ? Math.max(1, Math.round(distanceToNext / WALK_METERS_PER_MINUTE)) : null;

  // 남은 시간 = 미방문 정류지의 이동+체류 + 복귀 이동
  const remainingMinutes = completed
    ? 0
    : course.stops
        .slice(Math.min(currentIndex, course.stops.length))
        .reduce((total, stop) => total + stop.travelMinutesFromPrevious + stop.stayMinutes, 0) +
      course.returnTravelMinutes;

  const statusTitle = completed
    ? '코스를 모두 마쳤어요'
    : nextStop
      ? `${withRoJosa(nextStop.name)} 이동 중`
      : '코스를 따라 이동 중';
  const statusSubtitle = completed
    ? '복귀까지 완료했어요. 수고하셨어요!'
    : distanceToNext !== null && walkMinutes !== null
      ? `${formatDistance(distanceToNext)} · 도보 약 ${walkMinutes}분 남았어요`
      : status === 'denied'
        ? '위치 권한을 허용하면 남은 거리를 알려드려요'
        : '현재 위치를 확인하고 있어요';

  const etaPillLabel =
    !completed && nextStop && walkMinutes !== null
      ? `${nextStop.name.split(' ')[0]}까지 ${walkMinutes}분`
      : null;

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: Teumta.surface }} />

      <View style={styles.topBar}>
        <Pressable style={styles.topButton} onPress={() => router.back()}>
          <Image
            source={require('@/assets/images/icons/back.svg')}
            style={styles.topButtonIcon}
            contentFit="contain"
          />
        </Pressable>
        {etaPillLabel && (
          <View style={styles.etaPill}>
            <Text style={styles.etaPillLabel}>{etaPillLabel}</Text>
          </View>
        )}
      </View>

      <View style={styles.mapArea}>
        <CourseMapView
          detour={{
            id: 'generated',
            name: destination.name,
            durationMinutes: course.totalMinutes,
            distanceKm: 0,
            description: '',
            coordinates: [
              { latitude: destination.latitude, longitude: destination.longitude },
              ...course.stops.map((stop) => ({
                latitude: stop.latitude,
                longitude: stop.longitude,
              })),
              { latitude: destination.latitude, longitude: destination.longitude },
            ],
            stops: [
              destination.name,
              ...course.stops.map((stop) => stop.name),
              `${destination.name} 복귀`,
            ],
          }}
          showsUserLocation={status === 'granted'}
        />
      </View>

      <View style={[styles.sheet, { paddingBottom: 18 + insets.bottom }]}>
        <View style={styles.sheetHandle} />

        <View style={styles.statusCard}>
          <View style={styles.statusIconTile}>
            <Image
              source={require('@/assets/images/icons/arrow-move.svg')}
              style={styles.statusIcon}
              contentFit="contain"
            />
          </View>
          <View style={styles.statusTexts}>
            <Text style={styles.statusTitle}>{statusTitle}</Text>
            <Text style={styles.statusSubtitle}>{statusSubtitle}</Text>
          </View>
        </View>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>돌아갈 시간을 계산해 뒀어요</Text>
          <Text style={styles.noticeBody}>
            복귀 예정 시각을 기준으로 코스를 구성했어요. 목적지 혼잡도는 위에서 다시 확인할 수 있어요.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>복귀 예정</Text>
            <Text style={styles.statValue}>{timeLabelAfter(remainingMinutes)}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>목적지 혼잡</Text>
            <Text style={[styles.statValue, styles.statValueCongestion]}>
              {congestion ? REALTIME_LEVEL_LABEL[congestion.level] : '확인 중'}
            </Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>남은 코스</Text>
            <Text style={styles.statValue}>{remainingMinutes}분</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={styles.endButton}
            onPress={() => {
              // 중간에 끝내도 다녀온 기록으로 남긴다(완주 여부는 구분해 저장).
              if (selected && !completionLogged.current) {
                completionLogged.current = true;
                markCourseCompleted(selected, phase === 'completed');
              }
              router.dismissAll();
            }}>
            <Text style={styles.endButtonLabel}>코스 종료</Text>
          </Pressable>
          <Pressable
            style={[styles.directionsButton, !nextStop && styles.directionsButtonDisabled]}
            disabled={!nextStop}
            onPress={() => {
              if (nextStop) {
                void openDirections(nextStop);
              }
            }}>
            <Text style={styles.directionsButtonLabel}>길찾기 열기</Text>
          </Pressable>
        </View>

        <View style={styles.privacyStrip}>
          <View style={styles.privacyDot} />
          <Text style={styles.privacyText}>
            현재 위치는 기기 안에서만 확인하고 서버에는 보내지 않아요.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Teumta.background,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: Teumta.textSecondary,
    fontSize: 16,
  },
  emptyButton: {
    backgroundColor: Teumta.greenLight,
    borderRadius: 999,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyButtonLabel: {
    color: Teumta.greenDark,
    fontSize: 13,
    fontWeight: '700',
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    flexDirection: 'row',
    height: 52,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  topButton: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 13,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  topButtonIcon: {
    height: 19,
    width: 19,
  },
  etaPill: {
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  etaPillLabel: {
    color: Teumta.greenDark,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  mapArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Teumta.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    gap: 12,
    marginTop: -SHEET_OVERLAP,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#DBE3DE',
    borderRadius: 999,
    height: 5,
    width: 44,
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: Teumta.greenLight,
    borderRadius: 15,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  statusIconTile: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  statusIcon: {
    height: 21,
    width: 21,
  },
  statusTexts: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    color: Teumta.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  statusSubtitle: {
    color: Teumta.textSecondary,
    fontSize: 9,
    lineHeight: 13,
  },
  noticeBox: {
    backgroundColor: Teumta.greenLight,
    borderColor: '#BFE7D7',
    borderRadius: 13,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  noticeTitle: {
    color: Teumta.greenDark,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  noticeBody: {
    color: Teumta.textSecondary,
    fontSize: 9,
    lineHeight: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  statTile: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  statLabel: {
    color: Teumta.textTertiary,
    fontSize: 8,
    lineHeight: 11,
  },
  statValue: {
    color: Teumta.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  statValueCongestion: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  endButton: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 118,
  },
  endButtonLabel: {
    color: Teumta.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  directionsButton: {
    alignItems: 'center',
    backgroundColor: Teumta.green,
    borderRadius: 14,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  directionsButtonDisabled: {
    opacity: 0.5,
  },
  directionsButtonLabel: {
    color: Teumta.surface,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  privacyStrip: {
    alignItems: 'center',
    backgroundColor: '#F7F9F8',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  privacyDot: {
    backgroundColor: Teumta.green,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  privacyText: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 14,
  },
});
