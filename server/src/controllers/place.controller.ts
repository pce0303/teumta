import type { RequestHandler } from 'express';
import { PlaceType } from '@prisma/client';

import {
  createPlace,
  findMissingTagIds,
  getPlaceById,
  getPlaces,
  updatePlace,
} from '../services/place.service';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

function isValidRecommendedDuration(
  value: unknown,
): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

export const getPlacesController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const type = req.query.type;

    if (
      type !== undefined &&
      (typeof type !== 'string' ||
        !Object.values(PlaceType).includes(type as PlaceType))
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message:
            'type은 TOURIST_SPOT 또는 LOCAL_PLACE여야 합니다.',
        },
      });
      return;
    }

    const places = await getPlaces(type as PlaceType | undefined);

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

export const createPlaceController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const {
      name,
      type,
      address,
      latitude,
      longitude,
      imageUrl,
      description,
      openingTime,
      closingTime,
      recommendedDuration,
      tourApiContentId,
      tagIds,
    } = req.body;

    if (typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'name은 필수 문자열입니다.',
        },
      });
      return;
    }

    if (
      typeof type !== 'string' ||
      !Object.values(PlaceType).includes(type as PlaceType)
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message:
            'type은 TOURIST_SPOT 또는 LOCAL_PLACE여야 합니다.',
        },
      });
      return;
    }

    if (
      typeof latitude !== 'number' ||
      latitude < -90 ||
      latitude > 90
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'latitude는 -90 이상 90 이하의 숫자여야 합니다.',
        },
      });
      return;
    }

    if (
      typeof longitude !== 'number' ||
      longitude < -180 ||
      longitude > 180
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message:
            'longitude는 -180 이상 180 이하의 숫자여야 합니다.',
        },
      });
      return;
    }

    if (
      openingTime !== undefined &&
      openingTime !== null &&
      !isValidTime(openingTime)
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'openingTime은 HH:mm 형식이어야 합니다.',
        },
      });
      return;
    }

    if (
      closingTime !== undefined &&
      closingTime !== null &&
      !isValidTime(closingTime)
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'closingTime은 HH:mm 형식이어야 합니다.',
        },
      });
      return;
    }

    if (
      recommendedDuration !== undefined &&
      recommendedDuration !== null &&
      !isValidRecommendedDuration(recommendedDuration)
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message:
            'recommendedDuration은 양의 정수여야 합니다.',
        },
      });
      return;
    }

    if (
      tagIds !== undefined &&
      (!Array.isArray(tagIds) ||
        !tagIds.every(
          (tagId) => Number.isInteger(tagId) && tagId > 0,
        ))
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'tagIds는 양의 정수 배열이어야 합니다.',
        },
      });
      return;
    }
    if (tagIds !== undefined) {
      const missingTagIds = await findMissingTagIds(tagIds);

      if (missingTagIds.length > 0) {
        res.status(400).json({
          success: false,
          data: null,
          error: {
            message: `존재하지 않는 태그 ID가 포함되어 있습니다: ${missingTagIds.join(
              ', ',
            )}`,
          },
        });
        return;
      }
    }

    const place = await createPlace({
      name: name.trim(),
      type: type as PlaceType,
      address,
      latitude,
      longitude,
      imageUrl,
      description,
      openingTime,
      closingTime,
      recommendedDuration,
      tourApiContentId,
      tagIds,
    });

    res.status(201).json({
      success: true,
      data: place,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePlaceController: RequestHandler = async (
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

    const {
      name,
      type,
      address,
      latitude,
      longitude,
      imageUrl,
      description,
      openingTime,
      closingTime,
      recommendedDuration,
      tourApiContentId,
      tagIds,
    } = req.body;

    if (
      type !== undefined &&
      (typeof type !== 'string' ||
        !Object.values(PlaceType).includes(type as PlaceType))
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message:
            'type은 TOURIST_SPOT 또는 LOCAL_PLACE여야 합니다.',
        },
      });
      return;
    }

    if (
      name !== undefined &&
      (typeof name !== 'string' || name.trim() === '')
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'name은 비어 있지 않은 문자열이어야 합니다.',
        },
      });
      return;
    }

    if (
      latitude !== undefined &&
      (typeof latitude !== 'number' ||
        latitude < -90 ||
        latitude > 90)
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'latitude는 -90 이상 90 이하의 숫자여야 합니다.',
        },
      });
      return;
    }

    if (
      longitude !== undefined &&
      (typeof longitude !== 'number' ||
        longitude < -180 ||
        longitude > 180)
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'longitude는 -180 이상 180 이하의 숫자여야 합니다.',
        },
      });
      return;
    }

    if (
      openingTime !== undefined &&
      openingTime !== null &&
      !isValidTime(openingTime)
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'openingTime은 HH:mm 형식이어야 합니다.',
        },
      });
      return;
    }

    if (
      closingTime !== undefined &&
      closingTime !== null &&
      !isValidTime(closingTime)
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'closingTime은 HH:mm 형식이어야 합니다.',
        },
      });
      return;
    }

    if (
      recommendedDuration !== undefined &&
      recommendedDuration !== null &&
      !isValidRecommendedDuration(recommendedDuration)
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message:
            'recommendedDuration은 양의 정수여야 합니다.',
        },
      });
      return;
    }

    if (
      tagIds !== undefined &&
      (!Array.isArray(tagIds) ||
        !tagIds.every(
          (tagId) => Number.isInteger(tagId) && tagId > 0,
        ))
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'tagIds는 양의 정수 배열이어야 합니다.',
        },
      });
      return;
    }
    if (tagIds !== undefined) {
      const missingTagIds = await findMissingTagIds(tagIds);

      if (missingTagIds.length > 0) {
        res.status(400).json({
          success: false,
          data: null,
          error: {
            message: `존재하지 않는 태그 ID가 포함되어 있습니다: ${missingTagIds.join(
              ', ',
            )}`,
          },
        });
        return;
      }
    }

    const place = await updatePlace(id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(type !== undefined ? { type: type as PlaceType } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(openingTime !== undefined ? { openingTime } : {}),
      ...(closingTime !== undefined ? { closingTime } : {}),
      ...(recommendedDuration !== undefined
        ? { recommendedDuration }
        : {}),
      ...(tourApiContentId !== undefined
        ? { tourApiContentId }
        : {}),
      ...(tagIds !== undefined ? { tagIds } : {}),
    });

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