import type {
  CourseDestination,
  DestinationIdentifier,
  GeneratedCourse,
} from '@/types/course';

/**
 * 선택한 우회 코스를 화면 사이로 전달.
 *
 * 코스는 요청 시점 생성값이라 조회할 id가 없음. 라우트 파라미터로 넘기기엔 정류지·좌표까지
 * 담아야 해서 과대 → 메모리 보관(코스 목록 → 지도 → 진행).
 * 앱 재시작 시 비므로 각 화면에 값 없을 때의 안내 필요.
 */

export type SelectedCourse = {
  destination: CourseDestination;
  course: GeneratedCourse;
  availableMinutes: number;
  /** 목적지 식별자 — 진행 화면의 혼잡도 재조회용. */
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
