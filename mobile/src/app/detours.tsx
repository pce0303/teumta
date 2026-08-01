import { Image } from 'expo-image';
import { Link, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Teumta } from '@/constants/theme';
import { getMockPlaceById } from '@/mocks/places';
import type { DetourCourse, Place } from '@/types/place';
import { withRoJosa } from '@/utils/text';

const DURATION_FILTERS = ['30분', '60분', '90분'] as const;
const HEADER_TINTS = ['#A8D6C2', '#D6C7AB'];

function formatReturnTime(durationMinutes: number) {
  const returnAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  const hours = String(returnAt.getHours()).padStart(2, '0');
  const minutes = String(returnAt.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

type RouteCardProps = {
  detour: DetourCourse;
  place: Place;
  headerTint: string;
  badgeLabel: string;
  selected: boolean;
  onSelect: () => void;
};

function RouteCard({ detour, place, headerTint, badgeLabel, selected, onSelect }: RouteCardProps) {
  const stayMinutes = detour.stayMinutes ?? Math.round(detour.durationMinutes * 0.7);
  const stats = [
    { value: formatReturnTime(detour.durationMinutes), label: '예상 복귀' },
    { value: `${stayMinutes}분`, label: '추천 체류' },
    { value: `${detour.distanceKm}km`, label: '걷는 거리' },
  ];

  return (
    <Pressable
      onPress={onSelect}
      style={[styles.card, selected ? styles.cardSelected : styles.cardAlternative]}>
      <View
        style={[
          styles.cardHeader,
          { backgroundColor: headerTint },
          selected ? styles.cardHeaderSelected : styles.cardHeaderAlternative,
        ]}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{badgeLabel}</Text>
        </View>
        {selected ? (
          <View style={styles.summaryPill}>
            <Text style={styles.summaryText}>
              약 {detour.durationMinutes}분 · 도보 {detour.distanceKm}km · {withRoJosa(place.name)}{' '}
              복귀
            </Text>
          </View>
        ) : (
          <Text style={styles.headerDuration}>약 {detour.durationMinutes}분 코스</Text>
        )}
      </View>

      <View style={[styles.cardBody, selected ? styles.cardBodySelected : styles.cardBodyAlternative]}>
        <View style={styles.cardTitleRow}>
          <View style={selected ? styles.cardTexts : styles.cardTextsAlternative}>
            <Text style={selected ? styles.cardName : styles.cardNameAlternative}>
              {detour.name}
            </Text>
            <Text
              numberOfLines={1}
              style={selected ? styles.cardDescription : styles.cardDescriptionAlternative}>
              {detour.description}
            </Text>
          </View>
          <View style={selected ? styles.radioOn : styles.radioOff} />
        </View>

        {detour.stops && (
          <View style={styles.stopsRow}>
            {detour.stops.map((stop, index) => (
              <Fragment key={stop}>
                {index > 0 && <Text style={styles.stopArrow}>→</Text>}
                <Text style={styles.stopName}>{stop}</Text>
              </Fragment>
            ))}
          </View>
        )}

        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[styles.statTile, selected ? styles.statTileSelected : styles.statTileAlternative]}>
              <Text style={selected ? styles.statValue : styles.statValueAlternative}>
                {stat.value}
              </Text>
              <Text style={selected ? styles.statLabel : styles.statLabelAlternative}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

export default function DetoursScreen() {
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const place = getMockPlaceById(placeId) ?? getMockPlaceById('gyeongbokgung');
  const [selectedId, setSelectedId] = useState(place?.detours[0]?.id);
  const [duration, setDuration] = useState<(typeof DURATION_FILTERS)[number]>('60분');

  if (!place) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>코스를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: Teumta.surface }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Image
              source={require('@/assets/images/icons/back.svg')}
              style={styles.backIcon}
              contentFit="contain"
            />
          </Pressable>
          <View style={styles.headerTexts}>
            <Text style={styles.headerTitle}>틈타 코스</Text>
            <Text style={styles.headerSubtitle}>남는 시간에 맞춰 골라보세요.</Text>
          </View>
        </View>

        <View style={styles.chipRow}>
          {DURATION_FILTERS.map((item) => {
            const chipSelected = item === duration;
            return (
              <Pressable
                key={item}
                onPress={() => setDuration(item)}
                style={[styles.chip, chipSelected && styles.chipSelected]}>
                <Text style={[styles.chipLabel, chipSelected && styles.chipLabelSelected]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {place.detours.map((detour, index) => (
          <RouteCard
            key={detour.id}
            detour={detour}
            place={place}
            headerTint={HEADER_TINTS[index % HEADER_TINTS.length]}
            badgeLabel={index === 0 ? '가장 알맞아요' : '조금 더 여유롭게'}
            selected={detour.id === selectedId}
            onSelect={() => setSelectedId(detour.id)}
          />
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>추천 기준</Text>
          <Text style={styles.infoBody}>
            이동시간과 체류시간을 합쳐 계산하고, 복귀 전 최신 혼잡도를 다시 확인해요.
          </Text>
        </View>

        <Link href={`/course-map?placeId=${place.id}&detourId=${selectedId}` as Href} asChild>
          <Pressable style={styles.ctaButton}>
            <Text style={styles.ctaLabel}>선택한 코스 자세히 보기</Text>
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
  scroll: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
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
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 13,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  backIcon: {
    height: 19,
    width: 19,
  },
  headerTexts: {
    gap: 1,
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
  chipRow: {
    flexDirection: 'row',
    gap: 7,
  },
  chip: {
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipSelected: {
    backgroundColor: Teumta.greenLight,
    borderColor: Teumta.green,
  },
  chipLabel: {
    color: Teumta.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  chipLabelSelected: {
    color: Teumta.greenDark,
  },
  card: {
    backgroundColor: Teumta.surface,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: Teumta.green,
    borderRadius: 20,
    borderWidth: 2,
  },
  cardAlternative: {
    borderColor: Teumta.border,
    borderRadius: 18,
    borderWidth: 1,
  },
  cardHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardHeaderSelected: {
    height: 104,
    justifyContent: 'space-between',
  },
  cardHeaderAlternative: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    height: 70,
    justifyContent: 'space-between',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Teumta.surface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeLabel: {
    color: Teumta.greenDark,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 13,
  },
  summaryPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Teumta.greenLight,
    borderRadius: 12,
    height: 45,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  summaryText: {
    color: Teumta.greenDark,
    fontSize: 11,
    fontWeight: '700',
  },
  headerDuration: {
    color: Teumta.surface,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  cardBody: {
    backgroundColor: Teumta.surface,
    paddingHorizontal: 14,
  },
  cardBodySelected: {
    gap: 8,
    paddingVertical: 12,
  },
  cardBodyAlternative: {
    gap: 7,
    paddingVertical: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTexts: {
    gap: 2,
  },
  cardTextsAlternative: {
    gap: 1,
  },
  cardName: {
    color: Teumta.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  cardNameAlternative: {
    color: Teumta.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  cardDescription: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 14,
  },
  cardDescriptionAlternative: {
    color: Teumta.textSecondary,
    fontSize: 9,
    lineHeight: 13,
  },
  radioOn: {
    backgroundColor: Teumta.green,
    borderColor: Teumta.surface,
    borderRadius: 9,
    borderWidth: 4,
    height: 18,
    width: 18,
  },
  radioOff: {
    borderColor: Teumta.border,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    width: 18,
  },
  stopsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  stopName: {
    color: Teumta.textSecondary,
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 13,
  },
  stopArrow: {
    color: Teumta.textTertiary,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statTile: {
    backgroundColor: Teumta.greenLight,
    borderRadius: 10,
    flex: 1,
    gap: 1,
    paddingHorizontal: 8,
  },
  statTileSelected: {
    paddingVertical: 7,
  },
  statTileAlternative: {
    paddingVertical: 6,
  },
  statValue: {
    color: Teumta.greenDark,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  statValueAlternative: {
    color: Teumta.greenDark,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  statLabel: {
    color: Teumta.textSecondary,
    fontSize: 8,
    lineHeight: 11,
  },
  statLabelAlternative: {
    color: Teumta.textSecondary,
    fontSize: 7,
    lineHeight: 10,
  },
  infoBox: {
    backgroundColor: Teumta.greenLight,
    borderRadius: 14,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoTitle: {
    color: Teumta.greenDark,
    fontSize: 10,
    fontWeight: '700',
  },
  infoBody: {
    color: Teumta.textSecondary,
    fontSize: 10,
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
