import type { RequestHandler } from 'express';

import { env } from '../config/env';
import {
  issueAdminToken,
  verifyAdminPassword,
} from '../utils/admin-token';

/** POST /api/admin/login — ADMIN_PASSWORD 검증 후 만료 있는 토큰을 발급한다. */
export const adminLoginController: RequestHandler = (req, res, next) => {
  try {
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

    const password = req.body?.password;

    if (typeof password !== 'string' || password.length === 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'password는 비어 있지 않은 문자열이어야 합니다.',
        },
      });
      return;
    }

    if (!verifyAdminPassword(password, env.ADMIN_PASSWORD)) {
      res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '비밀번호가 올바르지 않습니다.',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: issueAdminToken(env.ADMIN_PASSWORD),
      error: null,
    });
  } catch (error) {
    next(error);
  }
};
