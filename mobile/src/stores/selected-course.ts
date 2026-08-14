import type {
  CourseDestination,
  DestinationIdentifier,
  GeneratedCourse,
} from '@/types/course';

/**
 * 사용자가 고른 우회 코스를 화면 사이에서 넘긴다.
 *
 * 코스는 서버가 요청 시점에 만들어 주는 값이라 조회할 id가 없다. 라우트 파라미터로 넘기기에는
 * 정류지·좌표까지 담아야 해서 너무 크므로 메모리에 들고 다닌다(코스 목록 → 지도 → 진행).
 * 앱을 다시 켜면 비므로 각 화면은 값이 없을 때의 안내를 갖춰야 한다.
 */

export type SelectedCourse = {
  destination: CourseDestination;
  course: GeneratedCourse;
  availableMinutes: number;
  /** 목적지 식별자 — 진행 화면에서 혼잡도를 다시 조회할 때 쓴다. */
  destinationParams: DestinationIdentifier;
};

let selected: SelectedCourse | null = null;

export function setSelectedCourse(next: SelectedCourse): void {
  selected = next;
}

export function getSelectedCourse(): SelectedCourse | null {
  return selected;
}

export function clearSelectedCourse(): void {
  selected = null;
}
