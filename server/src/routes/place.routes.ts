import { Router } from 'express';

import {
  createPlaceController,
  getNearbyLocalPlacesController,
  getPlaceByIdController,
  getPlacesController,
  updatePlaceController,
} from '../controllers/place.controller';

export const placeRouter = Router();

placeRouter.get('/places', getPlacesController);

placeRouter.get(
  '/places/:id/local-places',
  getNearbyLocalPlacesController,
);

placeRouter.get('/places/:id', getPlaceByIdController);

placeRouter.post('/admin/places', createPlaceController);
placeRouter.patch('/admin/places/:id', updatePlaceController);