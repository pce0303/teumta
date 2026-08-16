import type { CongestionLevel, RealtimeCongestion } from '@/types/place';

/** SK 혼잡도 단계 → 앱 공통 4단계(색상 팔레트 키). */
export const REALTIME_LEVEL_TO_CONGESTION_LEVEL: Record<
  RealtimeCongestion['level'],
  CongestionLevel
> = {
  RELAXED: 'low',
  NORMAL: 'medium',
  CROWDED: 'high',
  VERY_CROWDED: 'veryHigh',
};

/** SK 혼잡도 단계 → 화면 문구. */
export const REALTIME_LEVEL_LABEL: Record<RealtimeCongestion['level'], string> = {
  RELAXED: '여유',
  NORMAL: '보통',
  CROWDED: '혼잡',
  VERY_CROWDED: '매우 혼잡',
};
