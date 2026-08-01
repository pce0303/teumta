import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Teumta } from '@/constants/theme';
import { featuredPlaces } from '@/mocks/places';
import type { Place } from '@/types/place';

const REGIONS = ['전체', '서울', '부산', '전주', '제주'] as const;

type Region = (typeof REGIONS)[number];

function CongestionBadge({ place }: { place: Place }) {
  const palette = Teumta.congestion[place.congestionLevel];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{place.congestionLabel}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const [region, setRegion] = useState<Region>('전체');
  const [featured, ...restPlaces] = featuredPlaces;
  const regionPlaces = restPlaces.slice(0, 2);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Image
            source={require('@/assets/images/teumta-logo.svg')}
            style={styles.brandLogo}
            contentFit="contain"
          />
          <Text style={styles.brandName}>틈타</Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>오늘의 여행</Text>
          <Text style={styles.title}>어디로 떠나세요?</Text>
          <Text style={styles.subtitle}>붐비는 시간은 비켜가고, 여행은 그대로 이어가요.</Text>
        </View>

        <Link href={'/search' as Href} asChild>
          <Pressable style={styles.searchField}>
            <Image
              source={require('@/assets/images/icons/search.svg')}
              style={styles.searchIcon}
              contentFit="contain"
            />
            <Text style={styles.searchPlaceholder}>관광지나 지역을 검색해 보세요</Text>
          </Pressable>
        </Link>

        <View style={styles.chipRow}>
          {REGIONS.map((item) => {
            const selected = item === region;
            return (
              <Pressable
                key={item}
                onPress={() => setRegion(item)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>지금 인기 있는 관광지</Text>
          <Link href={'/search' as Href} asChild>
            <Pressable>
              <Text style={styles.sectionAction}>전체 보기</Text>
            </Pressable>
          </Link>
        </View>

        <Link href={`/places/${featured.id}` as Href} asChild>
          <Pressable style={styles.featuredCard}>
            <View style={styles.featuredImage} />
            <View style={styles.featuredBody}>
              <View style={styles.featuredTexts}>
                <Text style={styles.featuredName}>{featured.name}</Text>
                <Text style={styles.featuredMeta}>
                  {featured.area} · 주변 틈타 코스 {featured.detours.length}개
                </Text>
              </View>
              <CongestionBadge place={featured} />
            </View>
          </Pressable>
        </Link>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>다른 지역도 둘러보기</Text>
          <Text style={styles.sectionAction}>추천 기준</Text>
        </View>

        <View style={styles.regionRow}>
          {regionPlaces.map((place) => (
            <Link key={place.id} href={`/places/${place.id}` as Href} asChild>
              <Pressable style={styles.regionCard}>
                <View style={styles.regionImage} />
                <View style={styles.regionBody}>
                  <Text style={styles.regionName}>{place.name}</Text>
                  <Text style={styles.regionMeta}>
                    {place.area} · {place.congestionLabel}
                  </Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <View style={styles.navItem}>
          <Image
            source={require('@/assets/images/icons/tab-home.svg')}
            style={styles.navIcon}
            contentFit="contain"
          />
          <Text style={[styles.navLabel, styles.navLabelActive]}>홈</Text>
        </View>
        <Link href={'/search' as Href} asChild>
          <Pressable style={styles.navItem}>
            <Image
              source={require('@/assets/images/icons/tab-explore.svg')}
              style={styles.navIcon}
              contentFit="contain"
            />
            <Text style={styles.navLabel}>탐색</Text>
          </Pressable>
        </Link>
        <Link href={'/course-map' as Href} asChild>
          <Pressable style={styles.navItem}>
            <Image
              source={require('@/assets/images/icons/tab-trips.svg')}
              style={styles.navIcon}
              contentFit="contain"
            />
            <Text style={styles.navLabel}>내 여행</Text>
          </Pressable>
        </Link>
        <View style={styles.navItem}>
          <Image
            source={require('@/assets/images/icons/tab-my.svg')}
            style={styles.navIcon}
            contentFit="contain"
          />
          <Text style={styles.navLabel}>마이</Text>
        </View>
      </View>
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
    gap: 14,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  brandLogo: {
    height: 25,
    width: 32,
  },
  brandName: {
    color: Teumta.greenDark,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 32,
  },
  intro: {
    gap: 4,
  },
  eyebrow: {
    color: Teumta.greenDark,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  title: {
    color: Teumta.textPrimary,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 39,
  },
  subtitle: {
    color: Teumta.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
  },
  searchIcon: {
    height: 19,
    width: 19,
  },
  searchPlaceholder: {
    color: Teumta.textTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipSelected: {
    backgroundColor: Teumta.greenLight,
    borderColor: Teumta.green,
  },
  chipLabel: {
    color: Teumta.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  chipLabelSelected: {
    color: Teumta.greenDark,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: Teumta.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  sectionAction: {
    color: Teumta.greenDark,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  featuredCard: {
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  featuredImage: {
    backgroundColor: Teumta.imagePlaceholder,
    height: 130,
  },
  featuredBody: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  featuredTexts: {
    gap: 1,
  },
  featuredName: {
    color: Teumta.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  featuredMeta: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 14,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  regionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  regionCard: {
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  regionImage: {
    backgroundColor: Teumta.imagePlaceholder,
    height: 88,
  },
  regionBody: {
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  regionName: {
    color: Teumta.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  regionMeta: {
    color: Teumta.textSecondary,
    fontSize: 9,
    lineHeight: 13,
  },
  bottomNav: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    height: 82,
    justifyContent: 'space-between',
    marginBottom: 12,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 18,
  },
  navItem: {
    alignItems: 'center',
    gap: 3,
  },
  navIcon: {
    height: 20,
    width: 20,
  },
  navLabel: {
    color: Teumta.textTertiary,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 13,
  },
  navLabelActive: {
    color: Teumta.greenDark,
  },
});
