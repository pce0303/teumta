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
 * v2: 목적지 식별자만 저장하던 구조에서 표시용 정보까지 함께 저장하는 구조로 바꿨다.
 * 저장한 목적지는 서버 DB에 없을 수 있어(실시간 검색 결과) 이름을 다시 조회할 방법이 없기 때문이다.
 * 구 버전 값은 이름을 복원할 수 없으므로 키를 올려 버린다.
 */
const STORAGE_KEY = 'teumta:bookmarks:v2';

/** 저장한 목적지. 상세 화면을 다시 열 수 있도록 식별자와 표시 정보를 함께 둔다. */
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
 * 개인정보 최소화: 로그인 없이 단말 저장소(AsyncStorage)에만 보관하며 서버로 전송하지 않는다.
 *
 * 코스는 저장하지 않는다 — 우회 코스는 요청 시점에 생성되는 값이라 나중에 같은 코스를
 * 다시 만들어 준다고 보장할 수 없다. 목적지를 저장해 두면 코스는 그때 다시 추천받는다.
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
        // 손상된 저장값은 빈 상태로 시작한다.
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
