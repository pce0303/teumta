import { env } from '../config/env';
import { ingestConcentrationForecasts } from './congestion-ingestion.service';

/**
 * 집중률 예측 일일 자동 적재 스케줄러(외부 의존성 없음, setTimeout 체인).
 * KTO 집중률 API가 일 1회 갱신이므로 하루 한 번(KST 지정 시각) + 서버 기동 직후 1회 실행한다.
 * 대상은 PREDICTION_INGEST_TARGETS("areaCd:signguCd,...")로 지정, 비우면 비활성.
 */

export interface IngestTarget {
  areaCd: string;
  signguCd: string;
}

/** "11:11110,26:26350" → 대상 목록. 형식이 어긋난 항목은 무시한다. */
export function parseIngestTargets(raw: string): IngestTarget[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .flatMap((entry) => {
      const [areaCd, signguCd] = entry.split(':').map((part) => part.trim());
      if (!areaCd || !signguCd || !/^\d+$/.test(areaCd) || !/^\d+$/.test(signguCd)) {
        console.warn(`[prediction-scheduler] 잘못된 대상 형식 무시: "${entry}"`);
        return [];
      }
      return [{ areaCd, signguCd }];
    });
}

/** 다음 KST 지정 시각까지 남은 ms. */
export function msUntilNextKstHour(hourKst: number, now: Date = new Date()): number {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const next = new Date(kstNow);
  next.setUTCHours(hourKst, 0, 0, 0);
  if (next.getTime() <= kstNow.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - kstNow.getTime();
}

/** 대상 전체를 순차 적재한다. 개별 실패는 다음 대상으로 넘어간다(스케줄 중단 없음). */
export async function runPredictionIngest(targets: IngestTarget[]): Promise<void> {
  for (const target of targets) {
    try {
      const result = await ingestConcentrationForecasts(target);
      console.log(
        `[prediction-scheduler] areaCd=${target.areaCd} signguCd=${target.signguCd}: ` +
          `매칭 ${result.matchedPlaces}곳(alias ${result.aliasMatchedPlaces}), 저장 ${result.inserted}건, ` +
          `unmatched ${result.unmatched.length}, ambiguous ${result.ambiguous.length}`,
      );
    } catch (error) {
      // 오류 message에는 키/URL이 포함되지 않는다(외부 오류 계층 설계).
      console.error(
        `[prediction-scheduler] areaCd=${target.areaCd} signguCd=${target.signguCd} 실패:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/** 서버 기동 시 호출. 대상이 없으면 아무것도 하지 않는다. */
export function startPredictionIngestScheduler(): void {
  const targets = parseIngestTargets(env.PREDICTION_INGEST_TARGETS);
  if (targets.length === 0) {
    return;
  }

  console.log(
    `[prediction-scheduler] 활성화: ${targets.length}개 지역, 매일 ${env.PREDICTION_INGEST_HOUR_KST}시(KST)`,
  );

  // 기동 직후 1회(비차단) — 시연/재기동 시 최신 데이터 확보.
  void runPredictionIngest(targets);

  const scheduleNext = () => {
    const delay = msUntilNextKstHour(env.PREDICTION_INGEST_HOUR_KST);
    setTimeout(() => {
      void runPredictionIngest(targets).finally(scheduleNext);
    }, delay).unref();
  };
  scheduleNext();
}
