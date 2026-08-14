import { Router } from 'express';

import { adminLoginController } from '../controllers/admin-auth.controller';
import {
  createRouteController,
  deleteRouteController,
  listRoutesController,
  updateRouteController,
} from '../controllers/admin-route.controller';
import { loginRateLimitMiddleware } from '../middlewares/login-rate-limit.middleware';
import {
  deleteAliasController,
  listAliasesController,
  previewMatchingController,
  runMatchingIngestController,
  upsertAliasController,
} from '../controllers/concentration-matching.controller';
import {
  createTagController,
  deleteTagController,
  getTagsController,
} from '../controllers/tag.controller';

/** 인증 제외 대상: 로그인만. app.ts에서 adminAuthMiddleware보다 먼저 마운트한다. */
export const adminLoginRouter = Router();
adminLoginRouter.post('/', loginRateLimitMiddleware, adminLoginController);

/** 태그 조회는 공개(GET), 생성/삭제는 /api/admin/* 보호 범위. */
export const tagRouter = Router();
tagRouter.get('/tags', getTagsController);
tagRouter.post('/admin/tags', createTagController);
tagRouter.delete('/admin/tags/:id', deleteTagController);

/** 코스 관리(전부 관리자 보호 범위). 조회 전용 3.5/3.6은 공개 라우터(route.routes)에 있다. */
export const adminRouteRouter = Router();
adminRouteRouter.get('/admin/routes', listRoutesController);
adminRouteRouter.post('/admin/routes', createRouteController);
adminRouteRouter.patch('/admin/routes/:id', updateRouteController);
adminRouteRouter.delete('/admin/routes/:id', deleteRouteController);

/** KTO 집중률 매칭 운영 도구(전부 관리자 보호 범위). */
export const concentrationMatchingRouter = Router();
concentrationMatchingRouter.get(
  '/admin/concentration-matching/preview',
  previewMatchingController,
);
concentrationMatchingRouter.post(
  '/admin/concentration-matching/ingest',
  runMatchingIngestController,
);
concentrationMatchingRouter.get(
  '/admin/concentration-matching/aliases',
  listAliasesController,
);
concentrationMatchingRouter.post(
  '/admin/concentration-matching/aliases',
  upsertAliasController,
);
concentrationMatchingRouter.delete(
  '/admin/concentration-matching/aliases/:id',
  deleteAliasController,
);
