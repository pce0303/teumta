import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 최근 검색어(기기 전용). 검색 화면이 읽고 쓰고,
 * 마이 탭 "저장 데이터 전체 삭제"가 함께 지운다 — 화면 둘이 같은 키를 봐야 해서 분리.
 */
const STORAGE_KEY = 'teumta:recent-searches:v1';

export const MAX_RECENT_SEARCHES = 8;

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    // 손상된 저장값은 빈 상태로 시작
    return [];
  }
}

/** fire-and-forget — 저장 실패해도 검색 자체는 계속돼야 한다. */
export function saveRecentSearches(next: string[]): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

export function clearRecentSearchesStorage(): void {
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
