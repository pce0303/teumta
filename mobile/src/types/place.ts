export type CongestionLevel = 'low' | 'medium' | 'high';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type DetourCourse = {
  id: string;
  name: string;
  durationMinutes: number;
  distanceKm: number;
  description: string;
  coordinates: Coordinate[];
  /** 코스 경유지 이름 (표시용, 마지막은 복귀 지점) */
  stops?: string[];
  /** 코스 내 추천 체류 시간(분) */
  stayMinutes?: number;
};

export type Place = {
  id: string;
  name: string;
  area: string;
  shortDescription: string;
  description: string;
  congestionLevel: CongestionLevel;
  congestionLabel: string;
  congestionMessage: string;
  recommendedDurationMinutes: number;
  detours: DetourCourse[];
};
