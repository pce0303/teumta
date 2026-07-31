import { Router } from 'express';

import {
  createPlaceController,
  getPlaceByIdController,
  getPlacesController,
  updatePlaceController,
} from '../controllers/place.controller';

export const placeRouter = Router();

placeRouter.get('/places', getPlacesController);
placeRouter.post('/places', createPlaceController);
placeRouter.get('/places/:id', getPlaceByIdController);
placeRouter.patch('/places/:id', updatePlaceController);