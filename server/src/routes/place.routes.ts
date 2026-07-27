import { Router } from 'express';

import {
  getPlaceByIdController,
  getPlacesController,
} from '../controllers/place.controller';

export const placeRouter = Router();

placeRouter.get('/places', getPlacesController);
placeRouter.get('/places/:id', getPlaceByIdController);