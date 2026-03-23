import { rabbitMQ } from '../../core/queue';
import { deliverWithRetry } from '../processors/retry.processor';

export async function setupRetryConsumer(): Promise<void> {
  await rabbitMQ.consumeRetry(async (payload) => {
    try {
      console.log(`[Retry] Job ${payload.jobId} | Subscriber ${payload.subscriber.id} | Attempt ${payload.attempt + 1}`);
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
