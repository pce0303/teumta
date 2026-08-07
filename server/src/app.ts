import cors from 'cors';
import express from 'express';

import { healthRouter } from './routes/health.routes';
import {
  adminLoginRouter,
  concentrationMatchingRouter,
  tagRouter,
} from './routes/admin.routes';
import { placeRouter } from './routes/place.routes';
import { adminAuthMiddleware } from './middlewares/admin-auth.middleware';
import { errorMiddleware } from './middlewares/error.middleware';

export const app = express();

app.use(cors());
app.use(express.json());

app.use(healthRouter);

// 로그인은 인증 제외(미들웨어보다 먼저 마운트). 그 외 /api/admin/* 전부 토큰 필요.
app.use('/api/admin/login', adminLoginRouter);
app.use('/api/admin', adminAuthMiddleware);

app.use('/api', tagRouter);
app.use('/api', concentrationMatchingRouter);
app.use('/api', placeRouter);

app.use(errorMiddleware);
