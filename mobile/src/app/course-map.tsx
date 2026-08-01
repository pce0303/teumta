import { Image } from 'expo-image';
import { Link, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CourseMapView } from '@/components/course-map-view';
import { Teumta } from '@/constants/theme';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { getMockPlaceById } from '@/mocks/places';
import { withRoJosa } from '@/utils/text';
import { timeLabelAfter } from '@/utils/time';

const SHEET_OVERLAP = 26;
const DOT_START = '#FF9175';

export default function CourseMapScreen() {
  const { placeId, detourId } = useLocalSearchParams<{ placeId?: string; detourId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isCourseBookmarked, toggleCourseBookmark } = useBookmarks();
  const place = getMockPlaceById(placeId) ?? getMockPlaceById('gyeongbokgung');
  const detour = place?.detours.find((item) => item.id === detourId) ?? place?.detours[0];

  if (!place || !detour) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>코스를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const palette = Teumta.congestion[place.congestionLevel];
  const returnTimeLabel = timeLabelAfter(detour.durationMinutes);

  const stops = detour.stops ?? [];
  const middleStops = stops.slice(0, -1);
  const returnPlaceName = stops[stops.length - 1] ?? place.name;
  const stayTotal = detour.stayMinutes ?? Math.round(detour.durationMinutes * 0.7);
  const stayPerStop =
    middleStops.length > 0 ? Math.round(stayTotal / middleStops.length) : stayTotal;

  const rowCount = middleStops.length + 2;
  const timeAtRow = (index: number) =>
    timeLabelAfter(Math.round((detour.durationMinutes * index) / (rowCount - 1)));

  const timeline = [
    {
      key: 'start',
      dot: DOT_START,
      title: `${place.name} 앞 출발`,
      subtitle: middleStops[0] ? `${middleStops[0]}까지 도보 이동` : '코스를 따라 이동',
      time: timeAtRow(0),
    },
    ...middleStops.map((stop, index) => ({
      key: stop,
      dot: Teumta.green,
      title: stop,
      subtitle: `권장 체류 ${stayPerStop}분`,
      time: timeAtRow(index + 1),
    })),
    {
      key: 'return',
      dot: Teumta.greenDark,
      title: `${withRoJosa(returnPlaceName)} 복귀`,
      subtitle: '복귀 전에 최신 혼잡도 확인',
      time: timeAtRow(rowCount - 1),
    },
  ];

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
        <Pressable
          style={[
            styles.topButton,
            isCourseBookmarked(place.id, detour.id) && styles.topButtonSaved,
          ]}
          onPress={() => toggleCourseBookmark(place.id, detour.id)}>
          <Image
            source={require('@/assets/images/icons/bookmark.svg')}
            style={styles.topButtonIcon}
            contentFit="contain"
          />
        </Pressable>
      </View>

      <View style={styles.mapArea}>
        <CourseMapView detour={detour} />
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: 18 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitleTexts}>
            <Text style={styles.sheetTitle}>{detour.name}</Text>
            <Text style={styles.sheetSubtitle}>
              총 약 {detour.durationMinutes}분 · 도보 약 {detour.distanceKm}km
            </Text>
          </View>
          <View style={styles.returnPill}>
            <Text style={styles.returnPillLabel}>예상 복귀</Text>
            <Text style={styles.returnPillTime}>{returnTimeLabel}</Text>
          </View>
        </View>

        <View style={styles.timeline}>
          {timeline.map((entry) => (
            <View key={entry.key} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: entry.dot }]} />
              <View style={styles.timelineTexts}>
                <Text style={styles.timelineTitle}>{entry.title}</Text>
                <Text style={styles.timelineSubtitle}>{entry.subtitle}</Text>
              </View>
              <Text style={styles.timelineTime}>{entry.time}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statusStrip}>
          <View style={styles.statusColumn}>
            <Text style={styles.statusLabel}>현재 상태</Text>
            <Text style={[styles.statusNow, { color: palette.text }]}>{place.congestionLabel}</Text>
          </View>
          <Text style={styles.statusArrow}>→</Text>
          <View style={[styles.statusColumn, styles.statusColumnEnd]}>
            <Text style={styles.statusLabel}>복귀 전</Text>
            <Text style={styles.statusRecheck}>재확인</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>복귀 안내</Text>
          <Text style={styles.infoBody}>
            {returnTimeLabel} 복귀를 기준으로 코스를 구성했어요. 복귀 전 최신 혼잡도를 다시 확인해
            알려드려요.
          </Text>
        </View>

        <Link href={`/trip?placeId=${place.id}&detourId=${detour.id}` as Href} asChild>
          <Pressable style={styles.ctaButton}>
            <Text style={styles.ctaLabel}>이 코스로 출발하기</Text>
          </Pressable>
        </Link>
      </ScrollView>
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
  topBar: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    flexDirection: 'row',
    height: 50,
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
  topButtonSaved: {
    backgroundColor: Teumta.greenLight,
    borderColor: Teumta.green,
  },
  topButtonIcon: {
    height: 19,
    width: 19,
  },
  mapArea: {
    height: 256 + SHEET_OVERLAP,
  },
  sheet: {
    backgroundColor: Teumta.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    flex: 1,
    marginTop: -SHEET_OVERLAP,
  },
  sheetContent: {
    gap: 12,
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
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetTitleTexts: {
    gap: 2,
  },
  sheetTitle: {
    color: Teumta.textPrimary,
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 27,
  },
  sheetSubtitle: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 14,
  },
  returnPill: {
    alignItems: 'flex-end',
    backgroundColor: Teumta.greenLight,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  returnPillLabel: {
    color: Teumta.textSecondary,
    fontSize: 8,
    lineHeight: 11,
  },
  returnPillTime: {
    color: Teumta.greenDark,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  timeline: {
    gap: 6,
  },
  timelineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  timelineDot: {
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  timelineTexts: {
    flex: 1,
    gap: 1,
  },
  timelineTitle: {
    color: Teumta.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  timelineSubtitle: {
    color: Teumta.textSecondary,
    fontSize: 8,
    lineHeight: 11,
  },
  timelineTime: {
    color: Teumta.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 13,
  },
  statusStrip: {
    alignItems: 'center',
    backgroundColor: '#F7FAF7',
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statusColumn: {
    gap: 1,
  },
  statusColumnEnd: {
    alignItems: 'flex-end',
  },
  statusLabel: {
    color: Teumta.textTertiary,
    fontSize: 8,
    lineHeight: 11,
  },
  statusNow: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  statusArrow: {
    color: Teumta.textTertiary,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  statusRecheck: {
    color: Teumta.greenDark,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  infoBox: {
    backgroundColor: Teumta.greenLight,
    borderRadius: 14,
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoTitle: {
    color: Teumta.greenDark,
    fontSize: 11,
    fontWeight: '700',
  },
  infoBody: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },
  ctaButton: {
    alignItems: 'center',
    backgroundColor: Teumta.green,
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
  },
  ctaLabel: {
    color: Teumta.surface,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
