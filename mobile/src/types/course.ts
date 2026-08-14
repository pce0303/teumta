/** GET /api/courses 응답 타입. 서버가 요청 시점에 만들어 주는 값이라 DB에 저장되지 않는다. */

export type CourseStop = {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  /** 이전 지점(첫 정류지는 목적지)에서 여기까지 걷는 시간(분). */
  travelMinutesFromPrevious: number;
  distanceMetersFromPrevious: number;
  stayMinutes: number;
};

export type GeneratedCourse = {
  /** 이동 + 체류 + 복귀를 모두 더한 예상 소요시간(분). */
  totalMinutes: number;
  returnTravelMinutes: number;
  returnDistanceMeters: number;
  /** 정류지 사이 구간이 TMAP 실측이면 true(추정이면 false). */
  verified: boolean;
  stops: CourseStop[];
};

export type CourseDestination = {
  name: string;
  latitude: number;
  longitude: number;
};

export type CourseGenerationResult = {
  destination: CourseDestination;
  availableMinutes: number;
  courses: GeneratedCourse[];
};

/** 목적지 식별자. contentId(TourAPI) 또는 poiId(TMAP) 중 하나만 쓴다. */
export type DestinationIdentifier = { contentId: string } | { poiId: string };

/** 코스 전체 보행거리(m) — 정류지 구간 + 복귀 구간. */
export function courseDistanceMeters(course: GeneratedCourse): number {
  const stopsDistance = course.stops.reduce(
    (total, stop) => total + stop.distanceMetersFromPrevious,
    0,
  );
  return stopsDistance + course.returnDistanceMeters;
}

/** 코스 전체 체류시간(분). */
export function courseStayMinutes(course: GeneratedCourse): number {
  return course.stops.reduce((total, stop) => total + stop.stayMinutes, 0);
}
