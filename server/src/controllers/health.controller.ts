import type { Request, Response, NextFunction } from 'express';

import { getHealthStatus } from '../services/health.service';

export async function healthController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getHealthStatus();

    res.json({
      success: true,
      data,
      error: null,
    });
  } catch (error) {
    next(error);
  }
}
