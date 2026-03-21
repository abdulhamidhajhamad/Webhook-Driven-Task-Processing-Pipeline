import { jobRepository } from '../../modules/jobs/job.repository';
import { pipelineRepository } from '../../modules/pipelines/pipeline.repository';
import { deliveryRepository } from '../../modules/delivery/delivery.repository';
import { actions } from '../../actions';
import { ActionLog, ActionType } from '../../core/types';

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

async function deliverWithRetry(
  jobId: string,
  subscriber: { id: string; url: string },
  payload: Record<string, unknown>,
  attempt: number
): Promise<void> {
  try {
    const response = await fetch(subscriber.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    await deliveryRepository.create({
      jobId,
      subscriberId: subscriber.id,
      status: response.ok ? 'success' : 'failed',
      responseStatus: response.status,
      attemptNumber: attempt + 1,
      nextRetryAt: !response.ok && attempt < RETRY_DELAYS.length - 1
        ? new Date(Date.now() + RETRY_DELAYS[attempt + 1])
        : undefined,
    });

    if (!response.ok && attempt < RETRY_DELAYS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt + 1]));
      await deliverWithRetry(jobId, subscriber, payload, attempt + 1);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await deliveryRepository.create({
      jobId,
      subscriberId: subscriber.id,
      status: 'failed',
      error: errorMessage,
      attemptNumber: attempt + 1,
      nextRetryAt: attempt < RETRY_DELAYS.length - 1
        ? new Date(Date.now() + RETRY_DELAYS[attempt + 1])
        : undefined,
    });

    if (attempt < RETRY_DELAYS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt + 1]));
      await deliverWithRetry(jobId, subscriber, payload, attempt + 1);
    }
  }
}