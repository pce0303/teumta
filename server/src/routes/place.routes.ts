import { Router } from 'express';

import { getConcentrationForecastController } from '../controllers/congestion.controller';
import {
  createPlaceController,
  getNearbyLocalPlacesByContentIdController,
  getNearbyLocalPlacesController,
  getPlaceByIdController,
  getPlacesController,
  searchPlacesController,
  updatePlaceController,
} from '../controllers/place.controller';

export const placeRouter = Router();

// 검색 기반 흐름: 목적지 검색 → contentId 기준 주변 로컬 장소 추천
placeRouter.get('/search/places', searchPlacesController);
placeRouter.get('/local-places', getNearbyLocalPlacesByContentIdController);

placeRouter.get('/places', getPlacesController);

placeRouter.get(
  '/places/:id/local-places',
  getNearbyLocalPlacesController,
);

placeRouter.get(
  '/places/:id/concentration-forecast',
  getConcentrationForecastController,
);

placeRouter.get('/places/:id', getPlaceByIdController);

placeRouter.post('/admin/places', createPlaceController);
placeRouter.patch('/admin/places/:id', updatePlaceController);