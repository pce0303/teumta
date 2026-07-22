import { apiClient } from './client';
import { featuredPlaces } from '@/mocks/places';
import type { Place } from '@/types/place';

export async function getPlaces(): Promise<Place[]> {
  try {
    const response = await apiClient.get<{ data: Place[] }>('/places');
    return response.data.data;
  } catch {
    return featuredPlaces;
  }
}
