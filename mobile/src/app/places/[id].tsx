import { Image } from 'expo-image';
import { Link, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Teumta } from '@/constants/theme';
import { getMockPlaceById, getNearbyLocalPlaces } from '@/mocks/places';
import type { CongestionLevel } from '@/types/place';

const STATUS_BAR_TINT = '#CCE8DB';
const HERO_BAND = '#1C4738';

const CONGESTION_HEADLINE: Record<CongestionLevel, { title: string; subtitle: string }> = {
  low: { title: '지금은 여유로운 편이에요', subtitle: '현재 혼잡도가 낮은 상태예요.' },
  medium: { title: '지금은 무난한 편이에요', subtitle: '현재 혼잡도가 보통 상태예요.' },
  high: { title: '지금은 붐비는 편이에요', subtitle: '현재 혼잡도가 높은 상태예요.' },
};

const CONGESTION_BAR_RATIO: Record<CongestionLevel, number> = {
  low: 0.33,
  medium: 0.62,
  high: 0.79,
};

const LEGEND_STEPS = [
  { key: 'low', label: '여유' },
  { key: 'medium', label: '보통' },
  { key: 'high', label: '혼잡' },
  { key: 'veryHigh', label: '매우 혼잡' },
] as const;

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const place = getMockPlaceById(id);

  if (!place) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>관광지를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const palette = Teumta.congestion[place.congestionLevel];
  const headline = CONGESTION_HEADLINE[place.congestionLevel];
  const nearbyPlaces = getNearbyLocalPlaces(place.id);

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
          <View style={styles.heroButton}>
            <Image
              source={require('@/assets/images/icons/bookmark.svg')}
              style={styles.heroButtonIcon}
              contentFit="contain"
            />
          </View>
        </View>
        <View style={styles.heroImage} />
        <View style={styles.heroTitleBand}>
          <Text style={styles.heroTitle}>{place.name}</Text>
          <Text style={styles.heroSubtitle}>{place.area} · 실시간 혼잡도 기준</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.congestionCard}>
            <View style={styles.congestionHeader}>
              <View style={styles.congestionTexts}>
                <Text style={styles.congestionTitle}>{headline.title}</Text>
                <Text style={styles.congestionSubtitle}>{headline.subtitle}</Text>
              </View>
              <Text style={[styles.congestionLevel, { color: palette.text }]}>
                {place.congestionLabel}
              </Text>
            </View>
            <View style={styles.congestionTrack}>
              <View
                style={[
                  styles.congestionFill,
                  {
                    backgroundColor: palette.dot,
                    width: `${Math.round(CONGESTION_BAR_RATIO[place.congestionLevel] * 100)}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.congestionBanner}>
              <Image
                source={require('@/assets/images/icons/info.svg')}
                style={styles.bannerIcon}
                contentFit="contain"
              />
              <Text style={styles.bannerText}>{place.congestionMessage}</Text>
            </View>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>혼잡도 단계</Text>
            <Text style={styles.sectionAction}>4단계 기준</Text>
          </View>

          <View style={styles.legendRow}>
            {LEGEND_STEPS.map((step) => {
              const stepPalette = Teumta.congestion[step.key];
              const active = step.key === place.congestionLevel;
              return (
                <View
                  key={step.key}
                  style={[
                    styles.legendCard,
                    active && {
                      backgroundColor: stepPalette.background,
                      borderColor: stepPalette.text,
                    },
                  ]}>
                  <View style={[styles.legendDot, { backgroundColor: stepPalette.dot }]} />
                  <Text style={[styles.legendLabel, active && { color: stepPalette.text }]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>근처에서 잠깐 둘러볼 곳</Text>
            <Link href={`/course-map?placeId=${place.id}` as Href} asChild>
              <Pressable>
                <Text style={styles.sectionAction}>지도 보기</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.nearbyList}>
            {nearbyPlaces.map((nearby) => (
              <View key={nearby.id} style={styles.nearbyCard}>
                <View style={styles.nearbyThumb} />
                <View style={styles.nearbyTexts}>
                  <Text style={styles.nearbyName}>{nearby.name}</Text>
                  <Text style={styles.nearbyMeta}>
                    도보 {nearby.walkMinutes}분 · 권장 체류 {nearby.stayMinutes}분 ·{' '}
                    {nearby.congestionLabel}
                  </Text>
                </View>
                <Text style={styles.nearbyChevron}>›</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Link href={`/detours?placeId=${place.id}` as Href} asChild>
          <Pressable style={styles.ctaButton}>
            <Text style={styles.ctaLabel}>틈타 코스 보기</Text>
          </Pressable>
        </Link>
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
    justifyContent: 'space-between',
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
  congestionCard: {
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  congestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  congestionTexts: {
    gap: 2,
  },
  congestionTitle: {
    color: Teumta.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  congestionSubtitle: {
    color: Teumta.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  congestionLevel: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 36,
  },
  congestionTrack: {
    backgroundColor: '#F0F2F0',
    borderRadius: 999,
    height: 9,
    overflow: 'hidden',
  },
  congestionFill: {
    borderRadius: 999,
    height: 9,
  },
  congestionBanner: {
    alignItems: 'flex-start',
    backgroundColor: Teumta.greenLight,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  bannerIcon: {
    height: 16,
    marginTop: 1,
    width: 16,
  },
  bannerText: {
    color: Teumta.greenDark,
    flex: 1,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: Teumta.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  sectionAction: {
    color: Teumta.greenDark,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 9,
  },
  legendCard: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    height: 58,
    justifyContent: 'center',
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendLabel: {
    color: Teumta.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  nearbyList: {
    gap: 8,
  },
  nearbyCard: {
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
  nearbyThumb: {
    backgroundColor: Teumta.imagePlaceholder,
    borderRadius: 12,
    height: 52,
    width: 52,
  },
  nearbyTexts: {
    flex: 1,
    gap: 2,
  },
  nearbyName: {
    color: Teumta.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  nearbyMeta: {
    color: Teumta.textSecondary,
    fontSize: 9,
    lineHeight: 13,
  },
  nearbyChevron: {
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
