import { runMigrations } from '../core/db';
import { rabbitMQ } from '../core/queue';
import { processJob, deliverWithRetry } from './processors/job.processor';

async function setupMainConsumer(): Promise<void> {
  await rabbitMQ.consume(async (jobId: string) => {
    try {
      console.log(Received job: );
      await processJob(jobId);
      console.log(Job completed: );
    } catch (error) {
      console.error(Error processing job :, error);
    }
  });
}

async function setupRetryConsumer(): Promise<void> {
  await rabbitMQ.consumeRetry(async (payload) => {
    try {
      console.log([Retry] Job  | Subscriber  | Attempt );
      await deliverWithRetry(
        payload.jobId,
        payload.subscriber,
        payload.payload,
        payload.attempt
      );
    } catch (error) {
      console.error('Error processing retry:', error);
    }
  });
}

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

    console.log(Worker started successfully in [] mode.);
  } catch (error) {
    console.error('Worker failed to start:', error);
    process.exit(1);
  }
}

bootstrap();
