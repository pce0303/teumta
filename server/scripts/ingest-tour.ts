/**
 * TourAPI 장소 적재 수동 실행 스크립트.
 *
 * 위치기반:
 *   npm run ingest:tour -- <mapX(경도)> <mapY(위도)> [radius(m, 기본 2000)] [--rows=20]
 *   예: npm run ingest:tour -- 126.977 37.5788 2000 --rows=100
 *
 * 지역기반(법정동, 집중률 예측 매칭용 관광지 확보에 사용):
 *   npm run ingest:tour -- --area --lDongRegnCd=11 --lDongSignguCd=110 [--contentTypeId=12] [--rows=100]
 *
 * 사전 조건: server/.env 에 DATABASE_URL, TOUR_API_KEY(및 TOUR_API_BASE_URL) 설정 + DB 기동.
 */
import {
  ingestTourPlacesByArea,
  ingestTourPlacesByLocation,
} from '../src/services/place-ingestion.service';
import { prisma } from '../src/utils/prisma';

function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const numOfRows = Number(parseFlag('rows') ?? '20');

  if (process.argv.includes('--area')) {
    const lDongRegnCd = parseFlag('lDongRegnCd');
    const lDongSignguCd = parseFlag('lDongSignguCd');
    const contentTypeId = parseFlag('contentTypeId') ?? '12';

    if (!lDongRegnCd || !lDongSignguCd) {
      console.error(
        'Usage: npm run ingest:tour -- --area --lDongRegnCd=<시도코드> --lDongSignguCd=<시군구코드> [--contentTypeId=12] [--rows=100]',
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      `TourAPI 지역기반 적재 시작: lDongRegnCd=${lDongRegnCd}, lDongSignguCd=${lDongSignguCd}, contentTypeId=${contentTypeId}, rows=${numOfRows}`,
    );
    const result = await ingestTourPlacesByArea({
      lDongRegnCd,
      lDongSignguCd,
      contentTypeId,
      numOfRows,
    });
    console.log('적재 결과:', result);
    return;
  }

  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const mapX = Number(positional[0]);
  const mapY = Number(positional[1]);
  const radius = Number(positional[2] ?? '2000');

  if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
    console.error('Usage: npm run ingest:tour -- <mapX(경도)> <mapY(위도)> [radius(m)] [--rows=20]');
    process.exitCode = 1;
    return;
  }

  console.log(`TourAPI 위치기반 적재 시작: mapX=${mapX}, mapY=${mapY}, radius=${radius}m, rows=${numOfRows}`);
  const result = await ingestTourPlacesByLocation({ mapX, mapY, radius, numOfRows });
  console.log('적재 결과:', result);
}

main()
  .catch((error) => {
    console.error('적재 실패:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
