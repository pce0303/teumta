import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { featuredPlaces } from '@/mocks/places';

export default function HomeScreen() {
  const firstPlace = featuredPlaces[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>teumta</Text>
        <Text style={styles.title}>빈 시간에 바로 떠나는 관광 코스</Text>
        <Text style={styles.description}>
          현재 위치와 혼잡도를 기준으로 관광지를 찾고, 붐비는 구간은 우회 코스로 전환합니다.
        </Text>
      </View>

      <View style={styles.actions}>
        <Link href={'/search' as Href} asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>관광지 검색</Text>
          </Pressable>
        </Link>
        <Link href={`/places/${firstPlace.id}` as Href} asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>추천 관광지 보기</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>오늘의 추천</Text>
        <Text style={styles.placeName}>{firstPlace.name}</Text>
        <Text style={styles.summaryText}>{firstPlace.shortDescription}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 24,
  },
  header: {
    gap: 12,
    marginTop: 32,
  },
  eyebrow: {
    color: '#1f7a68',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#121417',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 42,
  },
  description: {
    color: '#4a5563',
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    gap: 12,
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
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d4d9df',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: '#1d2733',
    fontSize: 16,
    fontWeight: '700',
  },
  summary: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e6ea',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  summaryTitle: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '700',
  },
  placeName: {
    color: '#121417',
    fontSize: 20,
    fontWeight: '800',
  },
  summaryText: {
    color: '#4a5563',
    fontSize: 15,
    lineHeight: 22,
  },
});
