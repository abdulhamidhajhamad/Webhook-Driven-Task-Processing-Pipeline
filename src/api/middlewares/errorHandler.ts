import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../core/errors/AppError';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  void next;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  console.error('Unexpected Error:', err);
  res.status(500).json({
    error: 'Internal server error',
  });
};
