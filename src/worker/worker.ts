import { runMigrations } from '../core/db';
import { rabbitMQ } from '../core/queue';
import { processJob, deliverWithRetry } from './processors/job.processor';

async function start(): Promise<void> {
  try {
    await runMigrations();
    await rabbitMQ.connect();

    console.log(' Worker started successfully, waiting for jobs...');

    await rabbitMQ.consumeRetry(async (payload) => {
      try {
        console.log(`[Retry] Processing retry for job ${payload.jobId} to subscriber ${payload.subscriber.id} (Attempt ${payload.attempt + 1})`);
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

    await rabbitMQ.consume(async (jobId: string) => {
      try {
        console.log(` Received job: ${jobId}`);
        await processJob(jobId);
        console.log(` Job completed: ${jobId}`);
      } catch (jobError) {
        console.error(` Error processing job ${jobId}:`, jobError);
      }
    });

    const shutdown = async () => {
      console.log('Shutting down worker...');
      await rabbitMQ.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Worker failed to start:', error);
    process.exit(1);
  }
}

start();