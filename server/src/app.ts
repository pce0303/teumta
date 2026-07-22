import cors from 'cors';
import express from 'express';

import { healthRouter } from './routes/health.routes';
import { errorMiddleware } from './middlewares/error.middleware';

export const app = express();

app.use(cors());
app.use(express.json());

app.use(healthRouter);

app.use(errorMiddleware);
