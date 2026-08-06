import { CongestionLevel, CongestionType } from '@prisma/client';

import type { CongestionData } from '../../dtos';
import { ExternalApiResponseError } from '../common';
import type { SkCongestionResponse, SkCongestionRltmItem } from './congestion.dto';

/**
 * SK 퍼즐 실시간 혼잡도 원본 → CongestionData(type=REALTIME) 변환.
 * congestionLevel(1~4)을 내부 enum으로 매핑하고, 원본 지수는 정규화 기준이 없어 score는 null.
 */

const SERVICE = 'congestion';
const SOURCE = 'SK_PUZZLE';

/** 실시간 항목의 type 값. */
const RLTM_TYPE_REALTIME = 1;

const LEVEL_MAP: Record<number, CongestionLevel> = {
  1: CongestionLevel.RELAXED,
  2: CongestionLevel.NORMAL,
  3: CongestionLevel.CROWDED,
  4: CongestionLevel.VERY_CROWDED,
};

export function mapSkCongestionToCongestionData(raw: SkCongestionResponse): CongestionData {
  const item = pickRealtimeItem(raw);
  const level = LEVEL_MAP[item.congestionLevel];
  if (!level) {
    throw new ExternalApiResponseError(
      SERVICE,
      `Unknown congestionLevel ${item.congestionLevel}`,
    );
  }
  return {
    type: CongestionType.REALTIME,
    level,
    score: null,
    source: SOURCE,
    measuredAt: parseKstDatetime(item.datetime),
    predictedFor: null,
  };
}

/** rltm 배열에서 실시간(type=1) 항목을 고른다. 없으면 오류. */
export function pickRealtimeItem(raw: SkCongestionResponse): SkCongestionRltmItem {
  const items = raw.contents?.rltm ?? [];
  const realtime = items.find((item) => item.type === RLTM_TYPE_REALTIME) ?? items[0];
  if (!realtime) {
    throw new ExternalApiResponseError(SERVICE, 'No realtime congestion item in response');
  }
  return realtime;
}

/** yyyyMMddHHmmss(KST) → Date. */
function parseKstDatetime(value: string): Date | null {
  const raw = String(value ?? '').trim();
  if (!/^\d{12,14}$/.test(raw)) {
    return null;
  }
  const padded = raw.padEnd(14, '0');
  const iso = `${padded.slice(0, 4)}-${padded.slice(4, 6)}-${padded.slice(6, 8)}T${padded.slice(8, 10)}:${padded.slice(10, 12)}:${padded.slice(12, 14)}+09:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
