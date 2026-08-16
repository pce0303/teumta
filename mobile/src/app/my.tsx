import Constants from 'expo-constants';
import { Link } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceThumbnail } from '@/components/place-thumbnail';
import { TeumtaTabBar } from '@/components/teumta-tab-bar';
import { Teumta } from '@/constants/theme';
import { useBookmarks } from '@/hooks/use-bookmarks';

export default function MyScreen() {
  const { places: savedPlaces, clearBookmarks } = useBookmarks();

  const confirmClear = () => {
    Alert.alert('저장 데이터 삭제', '저장한 장소가 모두 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: clearBookmarks },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>마이</Text>
          <Text style={styles.headerSubtitle}>저장한 장소와 앱 설정을 관리해요.</Text>
        </View>

        <Text style={styles.sectionTitle}>저장한 장소</Text>
        {savedPlaces.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              아직 저장한 장소가 없어요.{'\n'}관광지 상세 화면의 북마크 버튼으로 저장할 수 있어요.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {savedPlaces.map((place) => (
              <Link
                key={`${place.source}-${place.id}`}
                href={{
                  pathname: '/places/[id]',
                  params: {
                    id: place.id,
                    source: place.source,
                    name: place.name,
                    ...(place.address ? { address: place.address } : {}),
                    ...(place.imageUrl ? { imageUrl: place.imageUrl } : {}),
                  },
                }}
                asChild>
                <Pressable style={styles.rowCard}>
                  {/* 저장 시점 이미지를 그대로 쓴다. 목적지는 분류가 없어 중립 배경으로 떨어진다. */}
                  <PlaceThumbnail
                    imageUrl={place.imageUrl}
                    variant="card"
                    style={styles.rowThumb}
                  />
                  <View style={styles.rowTexts}>
                    <Text style={styles.rowName}>{place.name}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {place.address ?? '주소 정보 없음'}
                    </Text>
                  </View>
                  <Text style={styles.rowChevron}>›</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>위치·개인정보</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>위치는 기기 안에서만 처리돼요</Text>
          <Text style={styles.infoCardBody}>
            현재 위치와 이동 경로는 서버로 전송하지 않아요. 저장한 장소도 이 기기 안에만
            보관됩니다.
          </Text>
          <Pressable onPress={confirmClear} hitSlop={8}>
            <Text style={styles.dangerAction}>저장 데이터 전체 삭제</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>앱 정보</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>버전</Text>
            <Text style={styles.infoRowValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>데이터 출처</Text>
            <Text style={styles.infoRowValue}>한국관광공사 · SK open API · TMAP</Text>
          </View>
        </View>
      </ScrollView>

      <TeumtaTabBar active="my" />
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
    gap: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    gap: 1,
    marginBottom: 2,
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
  sectionTitle: {
    color: Teumta.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 2,
  },
  emptyBox: {
    backgroundColor: '#F7F9F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  emptyText: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  list: {
    gap: 8,
  },
  rowCard: {
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
  rowThumb: {
    backgroundColor: Teumta.imagePlaceholder,
    borderRadius: 12,
    height: 52,
    width: 52,
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    color: Teumta.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  rowMeta: {
    color: Teumta.textSecondary,
    fontSize: 9,
    lineHeight: 13,
  },
  rowChevron: {
    color: Teumta.textTertiary,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
  },
  infoCard: {
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoCardTitle: {
    color: Teumta.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  infoCardBody: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },
  dangerAction: {
    color: Teumta.congestion.high.text,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 2,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoRowLabel: {
    color: Teumta.textSecondary,
    fontSize: 10,
    lineHeight: 14,
  },
  infoRowValue: {
    color: Teumta.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
});
