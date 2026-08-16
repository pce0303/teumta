import { useCallback, useState } from 'react';

import { ARRIVAL_RADIUS_METERS } from '@/constants/location';
import type { Coordinate } from '@/types/place';
import { hasArrived } from '@/utils/arrival';
import { distanceInMeters } from '@/utils/distance';

export type CourseStop = Coordinate & { id: string; name: string };
export type ProgressPhase = 'not_started' | 'in_progress' | 'completed';

/**
 * 도착 반경보다 넉넉히 벗어나야 "체류 끝"으로 본다.
 * 같은 반경을 쓰면 GPS 요동만으로 도착↔이동이 깜빡인다(히스테리시스).
 */
const STAY_LEAVE_RADIUS_METERS = ARRIVAL_RADIUS_METERS * 1.5;

/**
 * 코스 진행 상태(시작/도착/체류/다음/복귀/완료)를 **단말 local state로만** 관리한다.
 *
 * 개인정보 최소화 원칙:
 *  - 진행 상태와 도착 판정을 서버 TripEvent로 전송/저장하지 않는다.
 *  - 현재 위치가 다음 목적지 반경에 들어오면 로컬에서 도착 처리하고 다음 지점으로 넘어간다.
 *  - 서버에는 사용자가 특정 시각 특정 장소에 있었다는 정보가 남지 않는다.
 */
export function useCourseProgress(stops: CourseStop[]) {
  const [phase, setPhase] = useState<ProgressPhase>('not_started');
  const [currentIndex, setCurrentIndex] = useState(0);
  // 방금 도착해 머무는 중인 정류지. 반경을 벗어나면 자동으로 풀린다.
  const [stayingAt, setStayingAt] = useState<CourseStop | null>(null);

  const nextStop: CourseStop | null = stops[currentIndex] ?? null;

  const start = useCallback(() => setPhase('in_progress'), []);

  const reset = useCallback(() => {
    setPhase('not_started');
    setCurrentIndex(0);
    setStayingAt(null);
  }, []);

  /**
   * 다음 정류지를 방문 처리 없이 넘긴다(가게가 닫혀 있는 등).
   * 마지막 지점(복귀)은 건너뛸 수 없다 — 코스를 끝내는 건 "코스 종료"의 몫.
   */
  const skipCurrent = useCallback(() => {
    if (phase !== 'in_progress' || currentIndex >= stops.length - 1) {
      return;
    }
    setStayingAt(null);
    setCurrentIndex((index) => index + 1);
  }, [phase, currentIndex, stops.length]);

  /** foreground GPS 갱신 시 호출. 도착·체류 이탈을 판정한다(전부 로컬). */
  const updateWithLocation = useCallback(
    (current: Coordinate) => {
      if (phase !== 'in_progress') {
        return;
      }
      if (stayingAt && distanceInMeters(current, stayingAt) > STAY_LEAVE_RADIUS_METERS) {
        setStayingAt(null);
      }
      if (!nextStop) {
        return;
      }
      if (hasArrived(current, nextStop, ARRIVAL_RADIUS_METERS)) {
        const isFinal = currentIndex + 1 >= stops.length;
        // 마지막 지점은 복귀 완료라 체류 개념이 없다.
        setStayingAt(isFinal ? null : nextStop);
        setCurrentIndex((index) => index + 1);
        if (isFinal) {
          setPhase('completed');
        }
      }
    },
    [phase, stayingAt, nextStop, currentIndex, stops.length],
  );

  return { phase, currentIndex, nextStop, stayingAt, start, reset, skipCurrent, updateWithLocation };
}
