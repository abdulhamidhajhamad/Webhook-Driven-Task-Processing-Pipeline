import { rabbitMQ } from '../../core/queue';
import { processJob } from '../processors/main.processor';

export async function setupMainConsumer(): Promise<void> {
  await rabbitMQ.consume(async (jobId: string) => {
    try {
      console.log(`Received job: ${jobId}`);
      await processJob(jobId);
      console.log(`Job completed: ${jobId}`);
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);
    }
  });
}
