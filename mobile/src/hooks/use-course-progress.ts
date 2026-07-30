import { useCallback, useState } from 'react';

import { ARRIVAL_RADIUS_METERS } from '@/constants/location';
import type { Coordinate } from '@/types/place';
import { hasArrived } from '@/utils/arrival';

export type CourseStop = Coordinate & { id: string; name: string };
export type ProgressPhase = 'not_started' | 'in_progress' | 'completed';

/**
 * 코스 진행 상태(시작/도착/다음/복귀/완료)를 **단말 local state로만** 관리한다.
 *
 * 개인정보 최소화 원칙:
 *  - 진행 상태와 도착 판정을 서버 TripEvent로 전송/저장하지 않는다.
 *  - 현재 위치가 다음 목적지 반경에 들어오면 로컬에서 도착 처리하고 다음 지점으로 넘어간다.
 *  - 서버에는 사용자가 특정 시각 특정 장소에 있었다는 정보가 남지 않는다.
 */
export function useCourseProgress(stops: CourseStop[]) {
  const [phase, setPhase] = useState<ProgressPhase>('not_started');
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextStop: CourseStop | null = stops[currentIndex] ?? null;

  const start = useCallback(() => setPhase('in_progress'), []);

  const reset = useCallback(() => {
    setPhase('not_started');
    setCurrentIndex(0);
  }, []);

  /** foreground GPS 갱신 시 호출. 도착하면 다음 지점으로 진행(전부 로컬). */
  const updateWithLocation = useCallback(
    (current: Coordinate) => {
      if (phase !== 'in_progress' || !nextStop) {
        return;
      }
      if (hasArrived(current, nextStop, ARRIVAL_RADIUS_METERS)) {
        setCurrentIndex((index) => {
          const next = index + 1;
          if (next >= stops.length) {
            setPhase('completed');
          }
          return next;
        });
      }
    },
    [phase, nextStop, stops.length],
  );

  return { phase, currentIndex, nextStop, start, reset, updateWithLocation };
}
