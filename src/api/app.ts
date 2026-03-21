import express from 'express';
import { pipelineRoutes } from './routes/pipeline.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { jobRoutes } from './routes/job.routes';
import { rawBodyMiddleware } from './middlewares/raw-body';
import { generalLimiter, webhookLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(generalLimiter);


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});


app.use('/pipelines', express.json(), pipelineRoutes);
app.use('/webhooks', webhookLimiter, rawBodyMiddleware, webhookRoutes);
app.use('/jobs', express.json(), jobRoutes);


app.use(errorHandler);

export { app };
