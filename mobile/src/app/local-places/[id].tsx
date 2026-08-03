import { Image } from 'expo-image';
import { Link, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Teumta } from '@/constants/theme';
import { getLocalPlaceById } from '@/mocks/places';
import { openDirections } from '@/utils/directions';

const STATUS_BAR_TINT = '#CCE8DB';
const HERO_BAND = '#1C4738';

/** 혼잡 라벨 문자열 → 혼잡도 팔레트 키 (로컬 장소 목데이터는 라벨만 가진다). */
const LABEL_LEVEL: Record<string, keyof typeof Teumta.congestion> = {
  여유: 'low',
  보통: 'medium',
  혼잡: 'high',
  '매우 혼잡': 'veryHigh',
};

export default function LocalPlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const found = getLocalPlaceById(id);

  if (!found) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>장소를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const { local, parent } = found;
  const palette = Teumta.congestion[LABEL_LEVEL[local.congestionLabel] ?? 'low'];
  const relatedDetours = parent.detours.filter((detour) => local.detourIds.includes(detour.id));

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: STATUS_BAR_TINT }} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroTopRow}>
          <Pressable style={styles.heroButton} onPress={() => router.back()}>
            <Image
              source={require('@/assets/images/icons/back.svg')}
              style={styles.heroButtonIcon}
              contentFit="contain"
            />
          </Pressable>
        </View>
        <View style={styles.heroImage} />
        <View style={styles.heroTitleBand}>
          <Text style={styles.heroTitle}>{local.name}</Text>
          <Text style={styles.heroSubtitle}>
            {parent.name}에서 도보 {local.walkMinutes}분
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.statsRow}>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>도보</Text>
              <Text style={styles.statValue}>{local.walkMinutes}분</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>권장 체류</Text>
              <Text style={styles.statValue}>{local.stayMinutes}분</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>혼잡도</Text>
              <Text style={[styles.statValue, { color: palette.text }]}>
                {local.congestionLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>소개</Text>
          <Text style={styles.description}>{local.description}</Text>

          <Text style={styles.sectionTitle}>이 장소를 지나는 틈타 코스</Text>
          {relatedDetours.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxText}>아직 이 장소를 지나는 코스가 없어요.</Text>
            </View>
          ) : (
            <View style={styles.courseList}>
              {relatedDetours.map((detour) => (
                <Link
                  key={detour.id}
                  href={`/course-map?placeId=${parent.id}&detourId=${detour.id}` as Href}
                  asChild>
                  <Pressable style={styles.courseCard}>
                    <View style={styles.courseThumb} />
                    <View style={styles.courseTexts}>
                      <Text style={styles.courseName}>{detour.name}</Text>
                      <Text style={styles.courseMeta}>
                        약 {detour.durationMinutes}분 · 도보 {detour.distanceKm}km
                      </Text>
                    </View>
                    <Text style={styles.courseChevron}>›</Text>
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable
          style={styles.ctaButton}
          onPress={() =>
            openDirections({
              name: local.name,
              latitude: local.latitude,
              longitude: local.longitude,
            })
          }>
          <Text style={styles.ctaLabel}>길찾기 열기</Text>
        </Pressable>
      </View>
    </View>
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
  heroTopRow: {
    backgroundColor: Teumta.surface,
    flexDirection: 'row',
    paddingBottom: 6,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  heroButton: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  heroButtonIcon: {
    height: 19,
    width: 19,
  },
  heroImage: {
    backgroundColor: Teumta.imagePlaceholder,
    height: 102,
  },
  heroTitleBand: {
    backgroundColor: HERO_BAND,
    gap: 1,
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  heroTitle: {
    color: Teumta.surface,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 32,
  },
  heroSubtitle: {
    color: Teumta.surface,
    fontSize: 11,
    lineHeight: 15,
  },
  content: {
    backgroundColor: Teumta.surface,
    gap: 14,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
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
  sectionTitle: {
    color: Teumta.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  description: {
    color: Teumta.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  emptyBox: {
    backgroundColor: '#F7F9F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  emptyBoxText: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  courseList: {
    gap: 8,
  },
  courseCard: {
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
  courseThumb: {
    backgroundColor: Teumta.imagePlaceholder,
    borderRadius: 12,
    height: 52,
    width: 52,
  },
  courseTexts: {
    flex: 1,
    gap: 2,
  },
  courseName: {
    color: Teumta.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  courseMeta: {
    color: Teumta.textSecondary,
    fontSize: 9,
    lineHeight: 13,
  },
  courseChevron: {
    color: Teumta.textTertiary,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
  },
  footer: {
    backgroundColor: Teumta.surface,
    paddingHorizontal: 20,
    paddingTop: 10,
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
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
