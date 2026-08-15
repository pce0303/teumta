import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * v2: 식별자만 저장 → 표시용 정보까지 함께 저장.
 * 저장한 목적지가 서버 DB에 없을 수 있어(실시간 검색 결과) 이름 재조회 불가.
 * 구 버전 값은 이름 복원이 안 되므로 키를 올려 폐기.
 */
const STORAGE_KEY = 'teumta:bookmarks:v2';

/** 저장한 목적지. 상세 재진입용 식별자 + 표시 정보. */
export type PlaceBookmark = {
  /** TourAPI contentId 또는 TMAP poiId. */
  id: string;
  source: 'TOUR' | 'TMAP';
  name: string;
  address: string | null;
};

type BookmarksState = {
  places: PlaceBookmark[];
};

type BookmarksContextValue = {
  ready: boolean;
  places: PlaceBookmark[];
  isPlaceBookmarked: (source: string, id: string) => boolean;
  togglePlaceBookmark: (place: PlaceBookmark) => void;
  clearBookmarks: () => void;
};

const EMPTY_STATE: BookmarksState = { places: [] };

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

function sameBookmark(bookmark: PlaceBookmark, source: string, id: string) {
  return bookmark.source === source && bookmark.id === id;
}

/**
 * 북마크(저장한 목적지) 상태.
 *
 * 개인정보 최소화: 로그인 없이 단말 저장소(AsyncStorage)에만 보관, 서버 전송 없음.
 *
 * 코스는 저장하지 않는다 — 요청 시점 생성값이라 나중에 같은 코스를 보장할 수 없음.
 * 목적지만 저장하고 코스는 그때 다시 추천.
 */
export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookmarksState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<BookmarksState>;
          setState({ places: Array.isArray(parsed.places) ? parsed.places : [] });
        }
      })
      .catch(() => {
        // 손상된 저장값은 빈 상태로 시작
      })
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: BookmarksState) => {
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const togglePlaceBookmark = useCallback(
    (place: PlaceBookmark) => {
      const exists = state.places.some((saved) => sameBookmark(saved, place.source, place.id));
      persist({
        places: exists
          ? state.places.filter((saved) => !sameBookmark(saved, place.source, place.id))
          : [...state.places, place],
      });
    },
    [state, persist],
  );

  const clearBookmarks = useCallback(() => {
    persist(EMPTY_STATE);
  }, [persist]);

  const value = useMemo<BookmarksContextValue>(
    () => ({
      ready,
      places: state.places,
      isPlaceBookmarked: (source, id) =>
        state.places.some((saved) => sameBookmark(saved, source, id)),
      togglePlaceBookmark,
      clearBookmarks,
    }),
    [ready, state, togglePlaceBookmark, clearBookmarks],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks() {
  const value = useContext(BookmarksContext);
  if (!value) {
    throw new Error('useBookmarks는 BookmarksProvider 안에서 사용해야 합니다.');
  }
  return value;
}
