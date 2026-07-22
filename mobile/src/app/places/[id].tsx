import { Link, type Href, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getMockPlaceById } from '@/mocks/places';

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = getMockPlaceById(id);

  if (!place) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>관광지를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.area}>{place.area}</Text>
        <Text style={styles.title}>{place.name}</Text>
        <Text style={styles.description}>{place.description}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>혼잡도</Text>
        <Text style={[styles.congestion, congestionStyles[place.congestionLevel]]}>
          {place.congestionLabel}
        </Text>
        <Text style={styles.panelText}>{place.congestionMessage}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>추천 체류 시간</Text>
        <Text style={styles.panelText}>{place.recommendedDurationMinutes}분</Text>
      </View>

      <Link href={`/detours?placeId=${place.id}` as Href} asChild>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>우회 코스 선택</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const congestionStyles = StyleSheet.create({
  low: {
    color: '#1f7a68',
  },
  medium: {
    color: '#9a6400',
  },
  high: {
    color: '#b42318',
  },
});

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#4a5563',
    fontSize: 16,
  },
  hero: {
    gap: 10,
  },
  area: {
    color: '#1f7a68',
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: '#121417',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
  },
  description: {
    color: '#4a5563',
    fontSize: 16,
    lineHeight: 24,
  },
  panel: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e6ea',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  panelTitle: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '800',
  },
  congestion: {
    fontSize: 22,
    fontWeight: '900',
  },
  panelText: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1f7a68',
    borderRadius: 8,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
