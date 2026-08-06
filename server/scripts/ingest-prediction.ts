/**
 * KTO 집중률 예측(TatsCnctrRateService) 수동 적재 스크립트.
 *
 * 데이터 의미: 향후 30일의 날짜별 집중률 예측(일 1회 갱신). 실시간·시간대별 아님.
 *
 * 실행:
 *   npm run ingest:prediction -- --areaCd=11 --signguCd=11110 [--name=경복궁]
 *
 * 사전 조건: server/.env 에 DATABASE_URL, PREDICTION_API_KEY(Decoding 키),
 * PREDICTION_API_BASE_URL 설정 + DB 기동. 미설정 시 호출 없이 즉시 실패한다.
 *
 * 보안: API 키·완성된 요청 URL은 출력하지 않는다.
 */
import { ingestConcentrationForecasts } from '../src/services/congestion-ingestion.service';
import { prisma } from '../src/utils/prisma';

function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const areaCd = parseFlag('areaCd');
  const signguCd = parseFlag('signguCd');
  const tAtsNm = parseFlag('name');

  if (!areaCd || !signguCd) {
    console.error(
      'Usage: npm run ingest:prediction -- --areaCd=<법정동 시도코드> --signguCd=<법정동 시군구코드(5자리)> [--name=<관광지명>]',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`집중률 예측 적재 시작: areaCd=${areaCd}, signguCd=${signguCd}${tAtsNm ? `, name=${tAtsNm}` : ''}`);
  const result = await ingestConcentrationForecasts({ areaCd, signguCd, tAtsNm });

  console.log(
    `적재 결과: 매칭 장소 ${result.matchedPlaces}곳, 저장 ${result.inserted}건(교체 ${result.deleted}건)`,
  );
  if (result.unmatched.length > 0) {
    console.log(`UNMATCHED(${result.unmatched.length}): ${result.unmatched.map((entry) => entry.tAtsNm).join(', ')}`);
  }
  if (result.ambiguous.length > 0) {
    for (const entry of result.ambiguous) {
      console.log(`AMBIGUOUS: ${entry.tAtsNm} → 후보 placeId [${entry.candidatePlaceIds.join(', ')}]`);
    }
  }
  if (result.skipped.length > 0) {
    console.log(`SKIPPED(${result.skipped.length}):`);
    for (const entry of result.skipped) {
      console.log(`  - ${entry.tAtsNm} ${entry.baseYmd}: ${entry.reason}`);
    }
  }
}

main()
  .catch((error) => {
    // 오류 message에는 URL/serviceKey가 포함되지 않는다(외부 오류 계층 설계 참조).
    console.error('적재 실패:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
