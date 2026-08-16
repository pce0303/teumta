import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuietNow } from '@/components/quiet-now';
import { TeumtaTabBar } from '@/components/teumta-tab-bar';
import { TourApiAttribution } from '@/components/tour-api-attribution';
import {
  AVAILABLE_REGIONS,
  destinationsInRegion,
  type FeaturedDestination,
  type Region,
} from '@/constants/destinations';
import { Teumta } from '@/constants/theme';

/** 목적지 상세로 넘길 파라미터. 상세 화면이 이 식별자로 실시간 정보를 조회한다. */
function detailHref(destination: FeaturedDestination) {
  return {
    pathname: '/places/[id]' as const,
    params: {
      id: destination.tourApiContentId,
      source: 'TOUR',
      name: destination.name,
      address: destination.address,
      ...(destination.imageUrl ? { imageUrl: destination.imageUrl } : {}),
    },
  };
}

export default function HomeScreen() {
  // null = 전체
  const [region, setRegion] = useState<Region | null>(null);
  const destinations = destinationsInRegion(region);
  // 대표 1곳을 위에 크게 두고 나머지는 전부 아래 격자에 편다.
  // 예전에는 2곳만 잘라 보여줘서 목적지를 늘려도 홈에는 3곳밖에 안 나왔다.
  const [featured, ...regionDestinations] = destinations;

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

        <QuietNow />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          <Pressable
            onPress={() => setRegion(null)}
            style={[styles.chip, region === null && styles.chipSelected]}>
            <Text style={[styles.chipLabel, region === null && styles.chipLabelSelected]}>
              전체
            </Text>
          </Pressable>
          {AVAILABLE_REGIONS.map((item) => {
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
        </ScrollView>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>붐비기 쉬운 대표 관광지</Text>
          {region !== null && (
            <Pressable onPress={() => setRegion(null)} hitSlop={8}>
              <Text style={styles.sectionAction}>전체 지역 보기</Text>
            </Pressable>
          )}
        </View>

        {featured && (
          <Link href={detailHref(featured)} asChild>
            <Pressable style={styles.featuredCard}>
              {featured.imageUrl ? (
                <Image
                  source={{ uri: featured.imageUrl }}
                  style={styles.featuredImage}
                  contentFit="cover"
                  // 지역을 바꾸면 같은 자리의 뷰가 재활용된다. 키가 없으면 새 이미지가
                  // 로드되기 전(또는 실패했을 때) 직전 지역 사진이 그대로 남는다.
                  recyclingKey={featured.tourApiContentId}
                />
              ) : (
                <View style={styles.featuredImage} />
              )}
              <View style={styles.featuredBody}>
                <View style={styles.featuredTexts}>
                  <Text style={styles.featuredName}>{featured.name}</Text>
                  <Text style={styles.featuredMeta}>
                    {featured.areaLabel} · 혼잡도와 우회 코스 확인
                  </Text>
                </View>
              </View>
            </Pressable>
          </Link>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>함께 둘러보기</Text>
        </View>

        <View style={styles.regionRow}>
          {regionDestinations.map((destination) => (
            <Link key={destination.tourApiContentId} href={detailHref(destination)} asChild>
              <Pressable style={styles.regionCard}>
                {destination.imageUrl ? (
                  <Image
                    source={{ uri: destination.imageUrl }}
                    style={styles.regionImage}
                    contentFit="cover"
                    recyclingKey={destination.tourApiContentId}
                  />
                ) : (
                  <View style={styles.regionImage} />
                )}
                <View style={styles.regionBody}>
                  <Text style={styles.regionName}>{destination.name}</Text>
                  <Text style={styles.regionMeta}>{destination.areaLabel}</Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>

        <TourApiAttribution style={styles.attribution} />
      </ScrollView>

      <TeumtaTabBar active="home" />
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
  attribution: {
    marginTop: 4,
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
    flexWrap: 'wrap',
    gap: 10,
  },
  regionCard: {
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 16,
    borderWidth: 1,
    // flex:1은 줄바꿈과 함께 쓰면 한 줄에 전부 밀어넣는다. 2열 격자라 폭을 고정한다.
    overflow: 'hidden',
    width: '48%',
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
});
