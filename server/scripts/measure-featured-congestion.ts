/**
 * 대표 목적지(mobile destinations.ts)의 실시간 혼잡도 제공 여부 전수 측정.
 *
 * 실행:
 *   npm run measure:congestion
 *
 * 서버의 실제 매칭 경로(resolveTmapPoiId — SK 제공 장소 인덱스 포함)를 그대로 태워
 * 앱과 같은 결과를 얻는다. 출력의 true/false를
 * mobile/src/constants/destinations.ts의 `hasRealtimeCongestion` 갱신 근거로 쓴다
 * (플래그는 정렬 힌트 전용 — 화면 표시는 항상 실제 응답값).
 *
 * 외부 호출: SK 목록 ≈30콜(24시간 캐시) + 목적지당 TourAPI 1 · TMAP 1~4 · SK 1.
 * 사전 조건: server/.env의 TOUR/TMAP/CONGESTION 키.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ExternalApiNotFoundError } from '../src/external/common';
import { getRealtimeCongestion } from '../src/services/congestion.service';
import { resolveTmapPoiId } from '../src/services/poi-matching.service';

interface Measured {
  contentId: string;
  name: string;
  has: boolean;
  note: string;
}

async function measure(contentId: string, name: string): Promise<Measured> {
  try {
    const poiId = await resolveTmapPoiId(contentId);
    if (poiId === null) {
      return { contentId, name, has: false, note: '매칭 실패' };
    }
    try {
      const view = await getRealtimeCongestion(poiId);
      return { contentId, name, has: true, note: `poiId ${poiId} · ${view.level}` };
    } catch (error) {
      if (error instanceof ExternalApiNotFoundError) {
        return { contentId, name, has: false, note: `poiId ${poiId} · SK 미커버` };
      }
      return { contentId, name, has: false, note: `조회 오류: ${(error as Error).message}` };
    }
  } catch (error) {
    return { contentId, name, has: false, note: `매칭 오류: ${(error as Error).message}` };
  }
}

async function main(): Promise<void> {
  const destinationsPath = path.resolve(
    process.cwd(),
    '../mobile/src/constants/destinations.ts',
  );
  const source = readFileSync(destinationsPath, 'utf8');
  const entries = [...source.matchAll(/tourApiContentId: '(\d+)',\s*\n\s*name: '([^']+)'/g)].map(
    (match) => ({ contentId: match[1], name: match[2] }),
  );

  console.log(`측정 대상 ${entries.length}곳\n`);

  const results: Measured[] = [];
  for (const entry of entries) {
    results.push(await measure(entry.contentId, entry.name));
    // 외부 API 예의상 간격
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  for (const result of results) {
    console.log(
      `${result.has ? 'true ' : 'false'}  ${result.contentId.padEnd(8)}  ${result.name}  (${result.note})`,
    );
  }
  console.log(`\nhasRealtimeCongestion true: ${results.filter((r) => r.has).length}/${results.length}`);
}

void main();
