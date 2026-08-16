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

import type { SelectedCourse } from '@/stores/selected-course';

/**
 * 코스 열람·완료 기록.
 *
 * 코스는 요청 시점 생성값이라 서버에서 다시 찾을 수 없다(북마크가 코스를 저장하지
 * 않는 이유 — use-bookmarks 참고). 대신 화면 복원에 필요한 스냅샷 전체를 남긴다.
 * 위치·이동 기록과 같은 원칙으로 기기(AsyncStorage)에만 보관하고 서버 전송 없음.
 */
const STORAGE_KEY = 'teumta:course-log:v1';

/** 오래 안 본 것부터 밀어내는 상한. */
const MAX_ENTRIES = 20;

export type CourseLogEntry = {
  /** 목적지+정류지+가용시간으로 만든 중복 방지 키. */
  key: string;
  /** 마지막으로 본 시각(ISO). "최근 본 코스" 정렬 기준. */
  viewedAt: string;
  /** 코스를 끝낸 시각(ISO). null이면 아직 다녀오지 않은 코스. */
  completedAt: string | null;
  /** 마지막 복귀 지점까지 도착 판정을 받고 끝냈으면 true, 중간 종료면 false. */
  completedAll: boolean;
  /** 재진입용 스냅샷 — 코스 지도 화면이 이 값으로 그대로 복원한다. */
  selected: SelectedCourse;
};

function entryKey(selected: SelectedCourse): string {
  return [
    selected.destination.name,
    ...selected.course.stops.map((stop) => stop.name),
    String(selected.availableMinutes),
  ].join('|');
}

/**
 * 저장값 방어 검증 — 스키마가 바뀌거나 값이 손상돼도 항목 하나가
 * 내 여행·마이 탭 렌더 전체를 죽이면 안 된다. 화면이 실제로 접근하는 필드만 본다.
 */
function isValidEntry(entry: unknown): entry is CourseLogEntry {
  const candidate = entry as Partial<CourseLogEntry> | null;
  return (
    typeof candidate?.key === 'string' &&
    typeof candidate.viewedAt === 'string' &&
    typeof candidate.selected?.destination?.name === 'string' &&
    typeof candidate.selected?.course?.totalMinutes === 'number' &&
    Array.isArray(candidate.selected?.course?.stops)
  );
}

type CourseLogContextValue = {
  ready: boolean;
  /** 최근에 본 순서. */
  entries: CourseLogEntry[];
  /** 다녀온 코스만, 최근에 끝낸 순서. */
  completedEntries: CourseLogEntry[];
  logViewedCourse: (selected: SelectedCourse) => void;
  markCourseCompleted: (selected: SelectedCourse, completedAll: boolean) => void;
  clearCourseLog: () => void;
};

const CourseLogContext = createContext<CourseLogContextValue | null>(null);

export function CourseLogProvider({ children }: { children: ReactNode }) {
  // 저장 배열은 viewedAt 내림차순을 유지한다 — 자르기(MAX_ENTRIES)가 곧 오래된 것 버리기.
  const [entries, setEntries] = useState<CourseLogEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as { entries?: unknown[] };
          setEntries(
            (Array.isArray(parsed.entries) ? parsed.entries : []).filter(isValidEntry),
          );
        }
      })
      .catch(() => {
        // 손상된 저장값은 빈 상태로 시작
      })
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: CourseLogEntry[]) => {
    setEntries(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: next })).catch(() => {});
  }, []);

  const logViewedCourse = useCallback(
    (selected: SelectedCourse) => {
      const key = entryKey(selected);
      const existing = entries.find((entry) => entry.key === key);
      const entry: CourseLogEntry = {
        key,
        viewedAt: new Date().toISOString(),
        // 다시 보는 것만으로 "다녀옴"이 지워지면 안 된다.
        completedAt: existing?.completedAt ?? null,
        completedAll: existing?.completedAll ?? false,
        selected,
      };
      persist([entry, ...entries.filter((other) => other.key !== key)].slice(0, MAX_ENTRIES));
    },
    [entries, persist],
  );

  const markCourseCompleted = useCallback(
    (selected: SelectedCourse, completedAll: boolean) => {
      const key = entryKey(selected);
      const existing = entries.find((entry) => entry.key === key);
      const now = new Date().toISOString();
      const entry: CourseLogEntry = {
        key,
        // 끝낸 것도 방금 쓴 기록이므로 열람 시각을 함께 올린다(정렬 유지).
        viewedAt: now,
        completedAt: now,
        // 한 번 완주한 코스는 이후 중간 종료로 격하하지 않는다.
        completedAll: (existing?.completedAll ?? false) || completedAll,
        selected,
      };
      persist([entry, ...entries.filter((other) => other.key !== key)].slice(0, MAX_ENTRIES));
    },
    [entries, persist],
  );

  const clearCourseLog = useCallback(() => {
    persist([]);
  }, [persist]);

  const value = useMemo<CourseLogContextValue>(
    () => ({
      ready,
      entries,
      completedEntries: entries
        .filter((entry) => entry.completedAt !== null)
        .sort((first, second) => (second.completedAt ?? '').localeCompare(first.completedAt ?? '')),
      logViewedCourse,
      markCourseCompleted,
      clearCourseLog,
    }),
    [ready, entries, logViewedCourse, markCourseCompleted, clearCourseLog],
  );

  return <CourseLogContext.Provider value={value}>{children}</CourseLogContext.Provider>;
}

export function useCourseLog() {
  const value = useContext(CourseLogContext);
  if (!value) {
    throw new Error('useCourseLog는 CourseLogProvider 안에서 사용해야 합니다.');
  }
  return value;
}
