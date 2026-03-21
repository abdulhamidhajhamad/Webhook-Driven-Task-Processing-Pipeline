import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 20, 
  message: { error: 'Too many webhook requests from this IP, please try again after 1 minute' },
  standardHeaders: true,
  legacyHeaders: false,
});
