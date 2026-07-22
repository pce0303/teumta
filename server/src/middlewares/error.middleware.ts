import type { ErrorRequestHandler } from 'express';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : 'Unexpected server error';

  console.error('Request failed:', message);

  res.status(500).json({
    success: false,
    data: null,
    error: {
      message,
    },
  });
};
