import type { RequestHandler } from 'express';

import { getConcentrationForecasts } from '../services/congestion.service';

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
