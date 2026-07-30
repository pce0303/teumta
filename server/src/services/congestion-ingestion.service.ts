import { CongestionType, Prisma } from '@prisma/client';

import type { CongestionData } from '../dtos';
import { prisma } from '../utils/prisma';

/**
 * 예측 혼잡도(집중률 예측) 데이터를 내부 Congestion 테이블에 적재하는 서비스.
 *
 * 설계 근거(협업 규칙 §4 데이터 인계):
 *  - 예측(PREDICTED) 데이터는 시계열로 축적/조회하므로 DB에 저장한다.
 *  - 실시간(REALTIME) 데이터는 저장하지 않고 서비스 함수로 pass-through 하므로 여기서 다루지 않는다.
 *
 * 이 서비스는 외부 API 스펙과 무관하다(내부 CongestionData + Prisma 스키마에만 의존).
 * 예측 API 연동이 완료되면 prediction.mapper 가 CongestionData[]를 만들어 이 서비스에 넘긴다.
 */

export interface CongestionSaveResult {
  /** 기존 예측 로우 삭제 수(재적재 시 교체). */
  replaced: number;
  inserted: number;
}

/**
 * 특정 장소의 예측 혼잡도를 저장한다.
 * 재적재 시 중복을 막기 위해 해당 장소의 기존 PREDICTED 로우를 지우고 새로 넣는다(replace 전략).
 * Congestion에는 (placeId, predictedFor) 유니크 제약이 없어 upsert 대신 교체 방식을 쓴다.
 */
export async function savePredictedCongestion(
  placeId: number,
  predictions: CongestionData[],
): Promise<CongestionSaveResult> {
  const rows = toPredictedCongestionRows(placeId, predictions);

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.congestion.deleteMany({
      where: { placeId, type: CongestionType.PREDICTED },
    });

    if (rows.length === 0) {
      return { replaced: deleted.count, inserted: 0 };
    }

    const created = await tx.congestion.createMany({ data: rows });
    return { replaced: deleted.count, inserted: created.count };
  });
}

/**
 * CongestionData[] → Congestion 삽입 로우[] (순수 변환, 오프라인 검증용).
 * PREDICTED 타입만 대상으로 한다(실시간이 섞여 들어와도 걸러낸다).
 */
export function toPredictedCongestionRows(
  placeId: number,
  predictions: CongestionData[],
): Prisma.CongestionCreateManyInput[] {
  return predictions
    .filter((prediction) => prediction.type === CongestionType.PREDICTED)
    .map((prediction) => ({
      placeId,
      type: CongestionType.PREDICTED,
      level: prediction.level,
      score: prediction.score,
      source: prediction.source,
      measuredAt: prediction.measuredAt,
      predictedFor: prediction.predictedFor,
    }));
}
