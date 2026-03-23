import { runMigrations } from '../core/db';
import { rabbitMQ } from '../core/queue';
import { setupMainConsumer } from './consumers/main.consumer';
import { setupRetryConsumer } from './consumers/retry.consumer';
import { setupSweepWorker } from './consumers/sweep.consumer';

function setupGracefulShutdown(): void {
  const shutdown = async () => {
    await rabbitMQ.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function bootstrap(): Promise<void> {
  try {
    await runMigrations();
    await rabbitMQ.connect();

    setupGracefulShutdown();

    const workerType = process.env.WORKER_TYPE || 'all';

    if (workerType === 'main' || workerType === 'all') {
      await setupMainConsumer();
    }

    if (workerType === 'retry' || workerType === 'all') {
      await setupRetryConsumer();
    }

    if (workerType === 'sweeper' || workerType === 'all') {
      setupSweepWorker();
    }

    console.log(`Worker started successfully in [${workerType}] mode.`);
  } catch (error) {
    console.error(`Worker failed to start:`, error);
    process.exit(1);
  }
}

bootstrap();
