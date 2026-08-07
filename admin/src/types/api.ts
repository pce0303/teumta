/** 서버 공통 응답 envelope. server/src/controllers 및 error.middleware.ts 기준. */
export interface ApiErrorBody {
  /** error.middleware가 변환한 오류에만 존재(예: INTERNAL_ERROR, EXTERNAL_API_UNAVAILABLE). */
  code?: string;
  message: string;
}

export type ApiResponse<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ApiErrorBody };
