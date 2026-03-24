import dns from 'dns/promises';
import { URL } from 'url';
import { isSafeUrl } from '../../core/utils/url-safety';
import { deliveryRepository } from '../../modules/delivery/delivery.repository';
import { rabbitMQ } from '../../core/queue';

export const RETRY_DELAYS = [0, 30_000, 300_000, 1_800_000, 3_600_000];

export async function deliverWithRetry(
  jobId: string,
  subscriber: { id: string; url: string },
  payload: Record<string, unknown>,
  attempt: number
): Promise<void> {
  const isOk = await executeDeliveryRequest(subscriber.url, payload);

  await recordAttemptAndScheduleRetry(
    jobId,
    subscriber,
    payload,
    attempt,
    isOk,
    isOk ? 'success' : undefined
  );
}


async function executeDeliveryRequest(
  url: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const isSafe = await isSafeUrl(url);
  if (!isSafe) {
    console.error(`Blocked SSRF attempt or invalid target URL: ${url}`);
    return false;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function recordAttemptAndScheduleRetry(
  jobId: string,
  subscriber: { id: string; url: string },
  payload: Record<string, unknown>,
  attempt: number,
  isOk: boolean,
  errorOrStatus?: string
): Promise<void> {
  await deliveryRepository.create({
    jobId,
    subscriberId: subscriber.id,
    status: isOk ? 'success' : 'failed',
    responseStatus: isOk ? 200 : undefined,
    error: !isOk ? errorOrStatus || 'Delivery failed' : undefined,
    attemptNumber: attempt + 1,
  });

  if (!isOk && attempt < RETRY_DELAYS.length - 1) {
    const nextDelay = RETRY_DELAYS[attempt + 1];
    if (nextDelay > 0) {
      await rabbitMQ.publishRetry(nextDelay, {
        jobId,
        subscriber,
        payload,
        attempt: attempt + 1,
      });
    } else {
      await deliverWithRetry(jobId, subscriber, payload, attempt + 1);
    }
  }
}

