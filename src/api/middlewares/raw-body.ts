import { Request, Response, NextFunction } from 'express';

export async function rawBodyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        (req as Request & { rawBody: string }).rawBody = raw;
        req.body = raw ? JSON.parse(raw) : {};
        next();
      } catch {
        res.status(400).json({ error: 'Invalid JSON body' });
      }
    });

    req.on('error', () => {
      res.status(400).json({ error: 'Error reading request body' });
    });

  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
  }
}