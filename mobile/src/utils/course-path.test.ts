import { describe, expect, it } from 'vitest';

import type { CourseStop, GeneratedCourse } from '@/types/course';

import { buildCourseRoutePath } from './course-path';

const DESTINATION = { name: '경복궁', latitude: 37.5796, longitude: 126.977 };

function stop(partial: Partial<CourseStop> & Pick<CourseStop, 'latitude' | 'longitude'>): CourseStop {
  return {
    name: '정류지',
    address: null,
    imageUrl: null,
    travelMinutesFromPrevious: 5,
    distanceMetersFromPrevious: 300,
    stayMinutes: 15,
    ...partial,
  };
}

function course(partial: Partial<GeneratedCourse>): GeneratedCourse {
  return {
    totalMinutes: 60,
    returnTravelMinutes: 5,
    returnDistanceMeters: 300,
    verified: true,
    stops: [],
    ...partial,
  };
}

describe('buildCourseRoutePath', () => {
  it('경로 필드가 없으면(구서버·저장 스냅샷) 지점 직선 연결로 폴백한다', () => {
    const result = buildCourseRoutePath(
      DESTINATION,
      course({ stops: [stop({ latitude: 37.58, longitude: 126.97 })] }),
    );
    expect(result).toEqual([
      { latitude: 37.5796, longitude: 126.977 },
      { latitude: 37.58, longitude: 126.97 },
      { latitude: 37.5796, longitude: 126.977 },
    ]);
  });

  it('구간 경로를 이어 붙이고 이음새 중복 좌표는 한 번만 남긴다', () => {
    const result = buildCourseRoutePath(
      DESTINATION,
      course({
        stops: [
          stop({
            latitude: 37.58,
            longitude: 126.97,
            pathFromPrevious: [
              { latitude: 37.5796, longitude: 126.977 }, // 출발점과 중복
              { latitude: 37.5798, longitude: 126.974 },
              { latitude: 37.58, longitude: 126.97 }, // 정류지 좌표와 중복
            ],
          }),
        ],
        returnPath: [
          { latitude: 37.58, longitude: 126.97 },
          { latitude: 37.5796, longitude: 126.977 },
        ],
      }),
    );
    expect(result).toEqual([
      { latitude: 37.5796, longitude: 126.977 },
      { latitude: 37.5798, longitude: 126.974 },
      { latitude: 37.58, longitude: 126.97 },
      { latitude: 37.5796, longitude: 126.977 },
    ]);
  });

  it('추정 구간(null)과 빈 경로는 해당 구간만 직선으로 폴백한다', () => {
    const result = buildCourseRoutePath(
      DESTINATION,
      course({
        stops: [
          stop({
            latitude: 37.58,
            longitude: 126.97,
            pathFromPrevious: [{ latitude: 37.5798, longitude: 126.974 }],
          }),
          stop({ latitude: 37.582, longitude: 126.968, pathFromPrevious: null }),
        ],
        returnPath: [],
      }),
    );
    expect(result).toEqual([
      { latitude: 37.5796, longitude: 126.977 },
      { latitude: 37.5798, longitude: 126.974 },
      { latitude: 37.58, longitude: 126.97 },
      { latitude: 37.582, longitude: 126.968 },
      { latitude: 37.5796, longitude: 126.977 },
    ]);
  });
});
