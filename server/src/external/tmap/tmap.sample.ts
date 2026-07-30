import type { TmapRouteResponse } from './tmap.dto';

/**
 * 공식 스펙 기반 예시 응답(오프라인 mapper 테스트용).
 * ⚠️ 실제 응답이 아니라 placeholder다. 실제 샘플 확보 시 교체한다.
 *
 * 사용 예:
 *   import { mapTmapRouteToRouteCalculation } from './tmap.mapper';
 *   import { SAMPLE_PEDESTRIAN_ROUTE } from './tmap.sample';
 *   console.log(mapTmapRouteToRouteCalculation(SAMPLE_PEDESTRIAN_ROUTE));
 */
export const SAMPLE_PEDESTRIAN_ROUTE: TmapRouteResponse = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [126.9769930325, 37.5788412226] },
      properties: {
        totalDistance: 1250, // m
        totalTime: 900, // 초 (= 15분)
        index: 0,
        pointType: 'SP',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [126.9769930325, 37.5788412226],
          [126.972, 37.579],
        ],
      },
      properties: { distance: 1250, time: 900, index: 1 },
    },
  ],
};
