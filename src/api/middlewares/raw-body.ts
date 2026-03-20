import { Request, Response, NextFunction } from 'express';
import getRawBody from 'raw-body';

export async function rawBodyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const raw = await getRawBody(req, {
      length: req.headers['content-length'],
      limit: '1mb',
      encoding: 'utf-8',
    });

    (req as Request & { rawBody: string }).rawBody = raw;
    req.body = JSON.parse(raw);
    next();
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
  }
}