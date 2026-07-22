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
