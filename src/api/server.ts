import express from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../core/config';
import { runMigrations } from '../core/db';
import { rabbitMQ } from '../core/queue';
import { pipelineRoutes } from './routes/pipeline.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { jobRoutes } from './routes/job.routes';
import { rawBodyMiddleware } from './middlewares/raw-body';

const app = express();

// Set up general rate limiting for all routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Set up strict rate limiting specifically for webhooks to prevent DoS attacks
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 requests per `window` (here, per 1 minute)
  message: { error: 'Too many webhook requests from this IP, please try again after 1 minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limit to all requests
app.use(generalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.use('/pipelines', express.json(), pipelineRoutes);
app.use('/webhooks', webhookLimiter, rawBodyMiddleware, webhookRoutes);
app.use('/jobs', express.json(), jobRoutes);

async function start(): Promise<void> {
  try {
    await runMigrations();
    await rabbitMQ.connect();
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();