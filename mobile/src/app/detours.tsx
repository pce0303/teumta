import { Link, type Href, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getMockPlaceById } from '@/mocks/places';

export default function DetoursScreen() {
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const place = getMockPlaceById(placeId) ?? getMockPlaceById('gyeongbokgung');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>우회 코스 선택</Text>
        <Text style={styles.description}>{place?.name} 주변 혼잡 구간을 피하는 코스입니다.</Text>
      </View>

      {place?.detours.map((detour) => (
        <Link
          key={detour.id}
          href={`/course-map?placeId=${place.id}&detourId=${detour.id}` as Href}
          asChild>
          <Pressable style={styles.card}>
            <Text style={styles.detourName}>{detour.name}</Text>
            <Text style={styles.meta}>
              {detour.durationMinutes}분 · {detour.distanceKm}km
            </Text>
            <Text style={styles.description}>{detour.description}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    padding: 20,
  },
  header: {
    gap: 8,
    marginBottom: 4,
  },
  title: {
    color: '#121417',
    fontSize: 28,
    fontWeight: '900',
  },
  description: {
    color: '#4a5563',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e6ea',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  detourName: {
    color: '#121417',
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: '#1f7a68',
    fontSize: 14,
    fontWeight: '800',
  },
});
