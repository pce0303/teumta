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

const STORAGE_KEY = 'teumta:bookmarks:v1';

export type CourseBookmark = {
  placeId: string;
  detourId: string;
};

type BookmarksState = {
  places: string[];
  courses: CourseBookmark[];
};

type BookmarksContextValue = {
  ready: boolean;
  placeIds: string[];
  courses: CourseBookmark[];
  isPlaceBookmarked: (placeId: string) => boolean;
  isCourseBookmarked: (placeId: string, detourId: string) => boolean;
  togglePlaceBookmark: (placeId: string) => void;
  toggleCourseBookmark: (placeId: string, detourId: string) => void;
  clearBookmarks: () => void;
};

const EMPTY_STATE: BookmarksState = { places: [], courses: [] };

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

/**
 * 북마크(저장한 장소·코스) 상태.
 *
 * 개인정보 최소화: 로그인 없이 단말 저장소(AsyncStorage)에만 보관하며
 * 서버로 전송하지 않는다.
 */
export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookmarksState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<BookmarksState>;
          setState({
            places: Array.isArray(parsed.places) ? parsed.places : [],
            courses: Array.isArray(parsed.courses) ? parsed.courses : [],
          });
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
    (placeId: string) => {
      persist({
        ...state,
        places: state.places.includes(placeId)
          ? state.places.filter((id) => id !== placeId)
          : [...state.places, placeId],
      });
    },
    [state, persist],
  );

  const toggleCourseBookmark = useCallback(
    (placeId: string, detourId: string) => {
      const exists = state.courses.some(
        (course) => course.placeId === placeId && course.detourId === detourId,
      );
      persist({
        ...state,
        courses: exists
          ? state.courses.filter(
              (course) => !(course.placeId === placeId && course.detourId === detourId),
            )
          : [...state.courses, { placeId, detourId }],
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
      placeIds: state.places,
      courses: state.courses,
      isPlaceBookmarked: (placeId) => state.places.includes(placeId),
      isCourseBookmarked: (placeId, detourId) =>
        state.courses.some((course) => course.placeId === placeId && course.detourId === detourId),
      togglePlaceBookmark,
      toggleCourseBookmark,
      clearBookmarks,
    }),
    [ready, state, togglePlaceBookmark, toggleCourseBookmark, clearBookmarks],
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
