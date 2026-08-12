import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { searchPlaces } from '@/api/places';
import type { SearchPlaceResult } from '@/types/place';

type SearchStatus = 'idle' | 'loading' | 'error';

export default function SearchScreen() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchPlaceResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');

  async function handleSearch() {
    const trimmed = keyword.trim();
    if (!trimmed) return;

    setStatus('loading');
    try {
      const data = await searchPlaces(trimmed);
      setResults(data);
      setStatus('idle');
    } catch {
      setResults([]);
      setStatus('error');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          placeholder="관광지, 지역, 테마 검색"
          placeholderTextColor="#7b8490"
          style={styles.searchInput}
        />
        <Pressable style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>검색</Text>
        </Pressable>
      </View>

      {status === 'loading' && <ActivityIndicator style={styles.stateBox} />}

      {status === 'error' && (
        <Text style={styles.stateText}>검색 중 문제가 발생했습니다. 다시 시도해 주세요.</Text>
      )}

      {status === 'idle' && results.length === 0 && keyword.trim().length > 0 && (
        <Text style={styles.stateText}>검색 결과가 없습니다.</Text>
      )}

      <View style={styles.list}>
        {results.map((place, index) => {
          const id = place.tourApiContentId ?? place.tmapPoiId ?? place.name;
          return (
            <Link
              key={`${place.source}-${id}-${index}`}
              href={{
                pathname: '/places/[id]',
                params: {
                  id,
                  source: place.source,
                  name: place.name,
                  ...(place.address && { address: place.address }),
                  ...(place.imageUrl && { imageUrl: place.imageUrl }),
                  ...(place.latitude != null && { latitude: String(place.latitude) }),
                  ...(place.longitude != null && { longitude: String(place.longitude) }),
                },
              }}
              asChild>
              <Pressable style={styles.card}>
                <Text style={styles.placeName}>{place.name}</Text>
                {place.address && <Text style={styles.location}>{place.address}</Text>}
              </Pressable>
            </Link>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    padding: 20,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d4d9df',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#1f7a68',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  stateBox: {
    marginTop: 8,
  },
  stateText: {
    color: '#687384',
    fontSize: 14,
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
  placeName: {
    color: '#121417',
    fontSize: 18,
    fontWeight: '800',
  },
  location: {
    color: '#687384',
    fontSize: 14,
  },
});
