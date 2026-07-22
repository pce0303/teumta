import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { featuredPlaces } from '@/mocks/places';

export default function SearchScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextInput
        placeholder="관광지, 지역, 테마 검색"
        placeholderTextColor="#7b8490"
        style={styles.searchInput}
      />

      <View style={styles.list}>
        {featuredPlaces.map((place) => (
          <Link key={place.id} href={`/places/${place.id}` as Href} asChild>
            <Pressable style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={[styles.badge, congestionStyles[place.congestionLevel]]}>
                  {place.congestionLabel}
                </Text>
              </View>
              <Text style={styles.location}>{place.area}</Text>
              <Text style={styles.description}>{place.shortDescription}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
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
    gap: 18,
    padding: 20,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d4d9df',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e6ea',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  placeName: {
    color: '#121417',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  badge: {
    fontSize: 13,
    fontWeight: '800',
  },
  location: {
    color: '#687384',
    fontSize: 14,
  },
  description: {
    color: '#4a5563',
    fontSize: 15,
    lineHeight: 22,
  },
});
