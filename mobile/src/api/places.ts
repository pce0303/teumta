import { apiClient } from './client';
import type {
  NearbyLocalPlaceResult,
  Place,
  RealtimeCongestion,
  SearchPlaceResult,
} from '@/types/place';

export async function getPlaces(): Promise<Place[]> {
  const response = await apiClient.get<{ data: Place[] }>('/places');
  return response.data.data;
}

export async function searchPlaces(keyword: string, pageNo = 1): Promise<SearchPlaceResult[]> {
  const response = await apiClient.get<{ data: SearchPlaceResult[] }>('/search/places', {
    params: { keyword, pageNo },
  });
  return response.data.data;
}

export async function getRealtimeCongestion(poiId: string): Promise<RealtimeCongestion> {
  const response = await apiClient.get<{ data: RealtimeCongestion }>('/congestion', {
    params: { poiId },
  });
  return response.data.data;
}

/** contentId(TOUR)/poiId(TMAP) 중 정확히 하나로 주변 로컬 장소를 조회한다. */
export async function getNearbyLocalPlaces(
  identifier: { contentId: string } | { poiId: string },
  radius = 2000,
): Promise<NearbyLocalPlaceResult[]> {
  const response = await apiClient.get<{ data: NearbyLocalPlaceResult[] }>('/local-places', {
    params: { ...identifier, radius },
  });
  return response.data.data;
}
