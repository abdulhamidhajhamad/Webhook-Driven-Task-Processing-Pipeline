import express from 'express';
import { config } from '../core/config';
import { runMigrations } from '../core/db';
import { rabbitMQ } from '../core/queue';
import { pipelineRoutes } from './routes/pipeline.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { rawBodyMiddleware } from './middlewares/raw-body';

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.use('/pipelines', express.json(), pipelineRoutes);
app.use('/webhooks', rawBodyMiddleware, webhookRoutes);

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