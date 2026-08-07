import type { RequestHandler } from 'express';
import { PlaceType } from '@prisma/client';

import {
  DEFAULT_RADIUS_METERS,
  MAX_RADIUS_METERS,
  getNearbyLocalPlacesByContentId,
  getNearbyLocalPlacesByPoiId,
  getNearbyLocalPlacesRealtime,
} from '../services/nearby-local-place.service';
import { searchDestinations } from '../services/place-search.service';
import {
  createPlace,
  deletePlace,
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

/** 목적지 검색(실시간 TourAPI). 검색 결과의 tourApiContentId가 이후 추천의 기준이 된다. */
export const searchPlacesController: RequestHandler = async (req, res, next) => {
  try {
    const keyword = req.query.keyword;

    if (typeof keyword !== 'string' || keyword.trim().length === 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'keyword는 비어 있지 않은 문자열이어야 합니다.',
        },
      });
      return;
    }

    const pageNo = req.query.pageNo === undefined ? 1 : Number(req.query.pageNo);
    if (!Number.isInteger(pageNo) || pageNo <= 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'pageNo는 양의 정수여야 합니다.',
        },
      });
      return;
    }

    const results = await searchDestinations({ keyword: keyword.trim(), pageNo });

    res.status(200).json({
      success: true,
      data: results,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자가 검색으로 고른 목적지 기준 주변 로컬 장소 조회.
 * 식별자는 contentId(TourAPI) 또는 poiId(TMAP) 중 정확히 하나.
 * 좌표는 API 입력으로 받지 않는다(privacy 정책 — 서버가 식별자로 해석).
 */
export const getNearbyLocalPlacesByContentIdController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const contentId = req.query.contentId;
    const poiId = req.query.poiId;
    const hasContentId = typeof contentId === 'string' && contentId.trim().length > 0;
    const hasPoiId = typeof poiId === 'string' && poiId.trim().length > 0;

    if (hasContentId === hasPoiId) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'contentId 또는 poiId 중 정확히 하나를 전달해야 합니다.',
        },
      });
      return;
    }

    const radius =
      req.query.radius === undefined ? DEFAULT_RADIUS_METERS : Number(req.query.radius);

    if (
      !Number.isFinite(radius) ||
      !Number.isInteger(radius) ||
      radius <= 0 ||
      radius > MAX_RADIUS_METERS
    ) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `radius는 1 이상 ${MAX_RADIUS_METERS} 이하의 정수여야 합니다.`,
        },
      });
      return;
    }

    const result = hasContentId
      ? await getNearbyLocalPlacesByContentId((contentId as string).trim(), radius)
      : await getNearbyLocalPlacesByPoiId((poiId as string).trim(), radius);

    if (result.status !== 'SUCCESS') {
      res.status(404).json({
        success: false,
        data: null,
        error: {
          message: '목적지를 찾을 수 없습니다.',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.places,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/** 주변 로컬 장소 실시간 조회. 외부 API 오류는 error.middleware가 502/503/504로 변환. */
export const getNearbyLocalPlacesController: RequestHandler =
  async (req, res, next) => {
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

      const radius =
        req.query.radius === undefined
          ? DEFAULT_RADIUS_METERS
          : Number(req.query.radius);

      if (
        !Number.isFinite(radius) ||
        !Number.isInteger(radius) ||
        radius <= 0 ||
        radius > MAX_RADIUS_METERS
      ) {
        res.status(400).json({
          success: false,
          data: null,
          error: {
            message: `radius는 1 이상 ${MAX_RADIUS_METERS} 이하의 정수여야 합니다.`,
          },
        });
        return;
      }

      const result = await getNearbyLocalPlacesRealtime(id, radius);

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

      if (result.status === 'NOT_TOURIST_SPOT') {
        res.status(400).json({
          success: false,
          data: null,
          error: {
            message:
              '주변 로컬 장소는 관광지를 기준으로만 조회할 수 있습니다.',
          },
        });
        return;
      }

      if (result.status === 'NO_TOUR_CONTENT_ID') {
        res.status(400).json({
          success: false,
          data: null,
          error: {
            message:
              '이 관광지는 TourAPI 연동 정보(tourApiContentId)가 없어 주변 로컬 장소를 조회할 수 없습니다.',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.places,
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

/** DELETE /api/admin/places/:id — 코스(Route/RouteStop)에서 사용 중이면 409. */
export const deletePlaceController: RequestHandler = async (
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

    const result = await deletePlace(id);

    if (result === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        data: null,
        error: {
          message: '장소를 찾을 수 없습니다.',
        },
      });
      return;
    }

    if (result === 'IN_USE') {
      res.status(409).json({
        success: false,
        data: null,
        error: {
          code: 'PLACE_IN_USE',
          message:
            '코스(Route)에서 사용 중인 장소는 삭제할 수 없습니다. 코스에서 먼저 제거하세요.',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { deleted: true },
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