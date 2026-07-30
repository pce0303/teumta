/**
 * TourAPI 위치기반 장소 적재 수동 실행 스크립트.
 *
 * 키 발급 후 바로 실행하기 위한 진입점.
 * 실행:
 *   npm run ingest:tour -- <mapX(경도)> <mapY(위도)> [radius(m, 기본 2000)]
 * 예:
 *   npm run ingest:tour -- 126.977 37.5788 2000
 *
 * 사전 조건: server/.env 에 DATABASE_URL, TOUR_API_KEY(및 TOUR_API_BASE_URL) 설정 + DB 기동.
 */
import { ingestTourPlacesByLocation } from '../src/services/place-ingestion.service';
import { prisma } from '../src/utils/prisma';

async function main(): Promise<void> {
  const mapX = Number(process.argv[2]);
  const mapY = Number(process.argv[3]);
  const radius = Number(process.argv[4] ?? '2000');

  if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
    console.error('Usage: npm run ingest:tour -- <mapX(경도)> <mapY(위도)> [radius(m)]');
    process.exitCode = 1;
    return;
  }

  console.log(`TourAPI 적재 시작: mapX=${mapX}, mapY=${mapY}, radius=${radius}m`);
  const result = await ingestTourPlacesByLocation({ mapX, mapY, radius });
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
