import type { RequestHandler } from 'express';

import {
  getPlaceById,
  getPlaces,
} from '../services/place.service';

export const getPlacesController: RequestHandler = async (
  _req,
  res,
  next,
) => {
  try {
    const places = await getPlaces();

    res.status(200).json({
      success: true,
      data: places,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

export const getPlaceByIdController: RequestHandler = async (
  req,
  res,
  next,
) => {
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

    const place = await getPlaceById(id);

    if (!place) {
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
      data: place,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};