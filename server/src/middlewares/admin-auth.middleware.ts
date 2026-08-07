import type { RequestHandler } from 'express';

import { env } from '../config/env';
import { verifyAdminToken } from '../utils/admin-token';

/**
 * /api/admin/* 보호 미들웨어.
 *
 * - Authorization: Bearer <token> 을 요구한다(토큰은 POST /api/admin/login 발급).
 * - ADMIN_PASSWORD 미설정 시 전부 거부한다(fail closed) — 인증 없이 열리는 상태를 만들지 않는다.
 * - 로그인 라우트는 이 미들웨어보다 먼저 마운트되어 제외된다(app.ts 순서 참조).
 */
export const adminAuthMiddleware: RequestHandler = (req, res, next) => {
  if (env.ADMIN_PASSWORD.length === 0) {
    res.status(503).json({
      success: false,
      data: null,
      error: {
        code: 'ADMIN_AUTH_NOT_CONFIGURED',
        message:
          '관리자 인증이 설정되지 않았습니다. 서버 환경변수 ADMIN_PASSWORD를 설정하세요.',
      },
    });
    return;
  }

  const authorization = req.headers.authorization;
  const token =
    typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';

  if (token.length === 0 || !verifyAdminToken(token, env.ADMIN_PASSWORD)) {
    res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: '관리자 인증이 필요합니다. 다시 로그인하세요.',
      },
    });
    return;
  }

  next();
};
