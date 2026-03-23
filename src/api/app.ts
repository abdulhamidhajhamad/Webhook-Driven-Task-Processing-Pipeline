import express from 'express';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { pipelineRoutes } from './routes/pipeline.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { jobRoutes } from './routes/job.routes';
import { rawBodyMiddleware } from './middlewares/raw-body';
import { generalLimiter, webhookLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(generalLimiter);

let swaggerDocument = {};
try {
  // In development, it's in the project root. In dist, it's relative to dist/api/app.js
  const swaggerPath = path.join(process.cwd(), 'swagger-output.json');
  swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
} catch (err) {
  console.log('Swagger file not found, please run `npm run swagger`');
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});


app.use('/pipelines', express.json(), pipelineRoutes);
app.use('/webhooks', webhookLimiter, rawBodyMiddleware, webhookRoutes);
app.use('/jobs', express.json(), jobRoutes);


app.use(errorHandler);

export { app };
