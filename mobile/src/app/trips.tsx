import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceThumbnail } from '@/components/place-thumbnail';
import { TeumtaTabBar } from '@/components/teumta-tab-bar';
import { Teumta } from '@/constants/theme';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { useCourseLog, type CourseLogEntry } from '@/hooks/use-course-log';
import { setSelectedCourse } from '@/stores/selected-course';
import { dateLabel } from '@/utils/time';

/**
 * 내 여행 탭.
 *
 * 예전에는 탭이 코스 지도 화면으로 바로 갔는데, 코스는 메모리에만 있어서
 * 앱을 껐다 켜면 항상 "선택한 코스 정보가 없어요"만 나왔다. 이제 기기에 남긴
 * 코스 기록과 저장한 목적지를 모아, 언제 들어와도 이어갈 거리를 보여준다.
 */
export default function TripsScreen() {
  const router = useRouter();
  const { entries } = useCourseLog();
  const { places: savedPlaces } = useBookmarks();

  const openEntry = (entry: CourseLogEntry) => {
    // 코스 지도 화면은 메모리 스토어를 읽으므로 스냅샷을 복원해 두고 이동한다.
    setSelectedCourse(entry.selected);
    router.push('/course-map');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>내 여행</Text>
          <Text style={styles.headerSubtitle}>봤던 코스와 저장한 목적지를 모아뒀어요.</Text>
        </View>

        <Text style={styles.sectionTitle}>최근 본 코스</Text>
        {entries.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              아직 본 코스가 없어요.{'\n'}목적지 상세에서 &apos;틈타 코스 보기&apos;를 누르면
              여기에 쌓여요.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {entries.map((entry) => (
              <Pressable key={entry.key} style={styles.rowCard} onPress={() => openEntry(entry)}>
                <View style={styles.minutesTile}>
                  <Text style={styles.minutesValue}>{entry.selected.course.totalMinutes}</Text>
                  <Text style={styles.minutesUnit}>분</Text>
                </View>
                <View style={styles.rowTexts}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {entry.selected.course.stops.map((stop) => stop.name).join(' · ')}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {entry.selected.destination.name} · {dateLabel(entry.viewedAt)}
                  </Text>
                </View>
                {entry.completedAt !== null && (
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneBadgeLabel}>
                      {entry.completedAll ? '완주' : '다녀옴'}
                    </Text>
                  </View>
                )}
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>저장한 목적지에서 시작</Text>
        {savedPlaces.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              목적지 상세에서 북마크해 두면{'\n'}여기서 바로 새 코스를 만들 수 있어요.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {savedPlaces.map((place) => (
              <Pressable
                key={`${place.source}-${place.id}`}
                style={styles.rowCard}
                onPress={() =>
                  router.push({
                    pathname: '/detours',
                    params: {
                      ...(place.source === 'TOUR' ? { contentId: place.id } : { poiId: place.id }),
                      name: place.name,
                    },
                  })
                }>
                <PlaceThumbnail imageUrl={place.imageUrl} variant="card" style={styles.rowThumb} />
                <View style={styles.rowTexts}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {place.address ?? '주소 정보 없음'}
                  </Text>
                </View>
                <View style={styles.startBadge}>
                  <Text style={styles.startBadgeLabel}>코스 만들기</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <TeumtaTabBar active="trips" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Teumta.background,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    gap: 1,
    marginBottom: 2,
  },
  headerTitle: {
    color: Teumta.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 28,
  },
  headerSubtitle: {
    color: Teumta.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  sectionTitle: {
    color: Teumta.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 2,
  },
  emptyBox: {
    backgroundColor: '#F7F9F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  emptyText: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  list: {
    gap: 8,
  },
  rowCard: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 8,
  },
  minutesTile: {
    alignItems: 'center',
    backgroundColor: Teumta.greenLight,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  minutesValue: {
    color: Teumta.greenDark,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  minutesUnit: {
    color: Teumta.greenDark,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 5,
  },
  rowThumb: {
    backgroundColor: Teumta.imagePlaceholder,
    borderRadius: 12,
    height: 52,
    width: 52,
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    color: Teumta.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  rowMeta: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 14,
  },
  doneBadge: {
    backgroundColor: Teumta.greenLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doneBadgeLabel: {
    color: Teumta.greenDark,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  startBadge: {
    backgroundColor: Teumta.greenLight,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  startBadgeLabel: {
    color: Teumta.greenDark,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  rowChevron: {
    color: Teumta.textTertiary,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
  },
});
