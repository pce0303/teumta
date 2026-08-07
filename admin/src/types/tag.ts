/** GET /api/tags 응답 항목(server/src/services/tag.service.ts 기준). */
export interface TagWithUsage {
  id: number;
  name: string;
  /** 이 태그가 지정된 장소 수. */
  placeCount: number;
}
