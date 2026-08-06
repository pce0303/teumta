import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // 외부 API 인증키. 실제 값은 .env에만 두고 코드/Git에는 넣지 않는다.
  // 미설정 시 빈 문자열로 두어 서버는 기동되되, 실제 호출 시점에 검증한다.
  TOUR_API_KEY: z.string().optional().default(''),
  CONGESTION_API_KEY: z.string().optional().default(''),
  TMAP_API_KEY: z.string().optional().default(''),
  PREDICTION_API_KEY: z.string().optional().default(''),

  // 외부 API base URL. TODO: 공식 스펙 확인 후 기본값/경로 규칙 확정.
  TOUR_API_BASE_URL: z.string().optional().default(''),
  CONGESTION_API_BASE_URL: z.string().optional().default(''),
  TMAP_API_BASE_URL: z.string().optional().default(''),
  PREDICTION_API_BASE_URL: z.string().optional().default(''),

  // 외부 API 공통 요청 timeout(ms).
  EXTERNAL_API_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  // 집중률 예측 일일 자동 적재 대상. "areaCd:signguCd" 쉼표 구분(예: "11:11110,26:26350").
  // 비우면 스케줄러 비활성(수동 스크립트만 사용).
  PREDICTION_INGEST_TARGETS: z.string().optional().default(''),
  // 일일 적재 실행 시각(KST, 0~23시).
  PREDICTION_INGEST_HOUR_KST: z.coerce.number().int().min(0).max(23).default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid server environment variables');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
