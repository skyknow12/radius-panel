import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Generate safe reference ID for administrative troubleshooting
  const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  logger.error(
    { err, errorId, path: req.path, method: req.method },
    `Unhandled internal server error [Ref: ${errorId}]`,
  );

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: `Recharge could not be completed. No changes were saved. Reference: ${errorId}`,
      reference_id: errorId,
    },
  });
}
