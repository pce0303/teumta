import { apiRequest } from './client';
import type { TagWithUsage } from '../types/tag';

/** GET /api/tags — 전체 태그(사용 장소 수 포함). */
export function fetchTags(): Promise<TagWithUsage[]> {
  return apiRequest<TagWithUsage[]>('/tags');
}

/** POST /api/admin/tags — 새 태그 생성(이름 unique, 중복 시 409). */
export function createTag(name: string): Promise<TagWithUsage> {
  return apiRequest<TagWithUsage>('/admin/tags', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
