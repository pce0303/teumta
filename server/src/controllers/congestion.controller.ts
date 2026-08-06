import type { RequestHandler } from 'express';

import {
  getConcentrationForecasts,
  getRealtimeCongestion,
} from '../services/congestion.service';

/** 실시간 혼잡도 조회(SK 퍼즐, 5분 캐시). poiId는 검색 결과의 tmapPoiId. */
export const getRealtimeCongestionController: RequestHandler = async (req, res, next) => {
  try {
    const poiId = req.query.poiId;

    if (typeof poiId !== 'string' || poiId.trim().length === 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'poiId는 비어 있지 않은 문자열이어야 합니다.',
        },
      });
      return;
    }

    const view = await getRealtimeCongestion(poiId.trim());

    res.status(200).json({
      success: true,
      data: view,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/** 집중률 예측 조회(향후 30일 날짜별, 실시간 아님). */
export const getConcentrationForecastController: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: '장소 ID는 양의 정수여야 합니다.',
        },
      });
      return;
    }

    const result = await getConcentrationForecasts(id);

    if (result.status === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        data: null,
        error: {
          message: '장소를 찾을 수 없습니다.',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        placeId: id,
        isRealtime: false,
        forecasts: result.forecasts,
      },
      error: null,
    });
  } catch (error) {
    next(error);
  }
};
