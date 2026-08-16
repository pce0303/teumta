import type { CourseDestination, GeneratedCourse } from '@/types/course';
import type { Coordinate } from '@/types/place';

/**
 * 지도 폴리라인용 전체 경로: 목적지 → 정류지들 → 목적지(복귀).
 *
 * 구간별 TMAP 실측 경로(pathFromPrevious/returnPath)를 이어 붙이고,
 * 경로가 없는 구간(추정 구간 null · 구버전 서버 응답 · 기기 저장 스냅샷)은
 * 지점 사이 직선으로 폴백한다 — 어떤 응답이 와도 기존 직선 그리기보다 나빠지지 않는다.
 */
export function buildCourseRoutePath(
  destination: CourseDestination,
  course: GeneratedCourse,
): Coordinate[] {
  const path: Coordinate[] = [];
  // TMAP 경로의 구간 경계는 지점 좌표와 사실상 같은 점이라 이음새마다 중복이 생긴다.
  const push = (point: Coordinate) => {
    const last = path[path.length - 1];
    if (last && last.latitude === point.latitude && last.longitude === point.longitude) {
      return;
    }
    path.push(point);
  };

  push({ latitude: destination.latitude, longitude: destination.longitude });
  for (const stop of course.stops) {
    for (const point of stop.pathFromPrevious ?? []) {
      push(point);
    }
    push({ latitude: stop.latitude, longitude: stop.longitude });
  }
  for (const point of course.returnPath ?? []) {
    push(point);
  }
  push({ latitude: destination.latitude, longitude: destination.longitude });

  return path;
}
