import type {
  CreatePlaceInput,
  Place,
  PlaceType,
  UpdatePlaceInput,
} from '../types/place';
import { apiRequest } from './client';

/** GET /api/places — type 미지정 시 전체. tags 포함. */
export function fetchPlaces(type?: PlaceType): Promise<Place[]> {
  const query = type ? `?type=${type}` : '';
  return apiRequest<Place[]>(`/places${query}`);
}

/** GET /api/places/:id */
export function fetchPlace(id: number): Promise<Place> {
  return apiRequest<Place>(`/places/${id}`);
}

/** POST /api/admin/places — 관리자 토큰 필요(admin-auth.middleware). */
export function createPlace(input: CreatePlaceInput): Promise<Place> {
  return apiRequest<Place>('/admin/places', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** PATCH /api/admin/places/:id — 전달한 필드만 수정. */
export function updatePlace(
  id: number,
  input: UpdatePlaceInput,
): Promise<Place> {
  return apiRequest<Place>(`/admin/places/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** DELETE /api/admin/places/:id — 코스에서 사용 중이면 409(PLACE_IN_USE). */
export function deletePlace(id: number): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/admin/places/${id}`, {
    method: 'DELETE',
  });
}
