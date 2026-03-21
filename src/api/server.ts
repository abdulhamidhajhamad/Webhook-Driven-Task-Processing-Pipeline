import { config } from '../core/config';
import { runMigrations } from '../core/db';
import { rabbitMQ } from '../core/queue';
import { app } from './app';

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