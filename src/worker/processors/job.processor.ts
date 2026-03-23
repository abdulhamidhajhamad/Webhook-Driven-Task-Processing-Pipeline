import { jobRepository } from '../../modules/jobs/job.repository';
import { pipelineRepository } from '../../modules/pipelines/pipeline.repository';
import { deliveryRepository } from '../../modules/delivery/delivery.repository';
import { actions } from '../../actions';
import { ActionLog, ActionType } from '../../core/types';
import { rabbitMQ } from '../../core/queue';

const RETRY_DELAYS = [0, 30_000, 300_000, 1_800_000, 3_600_000];

export async function processJob(jobId: string): Promise<void> {
  const job = await jobRepository.findById(jobId);
  if (!job) {
    console.error(`Job ${jobId} not found`);
    return;
  }

  const pipeline = await pipelineRepository.findWithDetails(job.pipelineId);
  if (!pipeline) {
    await jobRepository.markFailed(
      jobId,
      'Pipeline not found',
      { reason: 'Pipeline was deleted or deactivated' },
      0,
      []
    );
    return;
  }

  const actionsLog: ActionLog[] = [];
  let currentPayload = job.payload;

  for (const action of pipeline.actions) {
    const actionHandler = actions[action.actionType];

    if (!actionHandler) {
      const error = `Unknown action type: ${action.actionType}`;
      await jobRepository.markFailed(
        jobId,
        error,
        { actionType: action.actionType, orderIndex: action.orderIndex },
        action.orderIndex,
        actionsLog
      );
      return;
    }

    try {
      const result = await actionHandler.execute(
        currentPayload,
        action.actionConfig
      );

      if (result === null) {
        actionsLog.push({
          orderIndex: action.orderIndex,
          actionType: action.actionType as ActionType,
          status: 'completed',
          result: { filtered: true, reason: 'Amount below minimum threshold' },
        });

        await jobRepository.markFailed(
          jobId,
          'Amount below minimum threshold',
          { actionType: action.actionType, orderIndex: action.orderIndex },
          action.orderIndex,
          actionsLog
        );
        return;
      }

      actionsLog.push({
        orderIndex: action.orderIndex,
        actionType: action.actionType as ActionType,
        status: 'completed',
        result,
      });

      currentPayload = result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      actionsLog.push({
        orderIndex: action.orderIndex,
        actionType: action.actionType as ActionType,
        status: 'failed',
        error: errorMessage,
      });

      await jobRepository.markFailed(
        jobId,
        errorMessage,
        { actionType: action.actionType, orderIndex: action.orderIndex },
        action.orderIndex,
        actionsLog
      );
      return;
    }
  }

  await jobRepository.markCompleted(jobId, currentPayload, actionsLog);
  await deliverToSubscribers(jobId, pipeline.subscribers, currentPayload);
}

async function deliverToSubscribers(
  jobId: string,
  subscribers: { id: string; url: string }[],
  payload: Record<string, unknown>
): Promise<void> {
  for (const subscriber of subscribers) {
    await deliverWithRetry(jobId, subscriber, payload, 0);
  }
}

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