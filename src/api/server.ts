import express from 'express';
import { config } from '../core/config';
import { runMigrations } from '../core/db';
import { pipelineRoutes } from './routes/pipeline.routes';
import { webhookRoutes } from './routes/webhook.routes';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.use('/pipelines', pipelineRoutes);
app.use('/webhooks', webhookRoutes);

async function start(): Promise<void> {
  try {
    await runMigrations();
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();