import { runMigrations } from '../core/db';
import { rabbitMQ } from '../core/queue';
import { processJob, processDueRetries } from './processors/job.processor';

const RETRY_POLLING_INTERVAL = 10_000; // Poll for retries every 10 seconds

async function start(): Promise<void> {
  try {
    await runMigrations();
    await rabbitMQ.connect();

    console.log(' Worker started successfully, waiting for jobs...');

    const retryInterval = setInterval(async () => {
      await processDueRetries();
    }, RETRY_POLLING_INTERVAL);

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
      console.log('📦 Shutting down worker...');
      clearInterval(retryInterval);
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