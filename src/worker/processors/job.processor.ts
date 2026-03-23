import dns from 'dns/promises';
import { URL } from 'url';
import { jobRepository } from '../../modules/jobs/job.repository';
import { pipelineRepository } from '../../modules/pipelines/pipeline.repository';
import { deliveryRepository } from '../../modules/delivery/delivery.repository';
import { actions } from '../../actions';
import { ActionLog, ActionType } from '../../core/types';
import { rabbitMQ } from '../../core/queue';

const RETRY_DELAYS = [0, 30_000, 300_000, 1_800_000, 3_600_000];

class PipelineExecutor {
  static async executeActions(
    payload: Record<string, unknown>,
    actionsList: any[]
  ) {
    const actionsLog: ActionLog[] = [];
    let currentPayload = payload;

    for (const action of actionsList) {
      const actionHandler = actions[action.actionType];

      if (!actionHandler) {
        const error = `Unknown action type: ${action.actionType}`;
        actionsLog.push({
          orderIndex: action.orderIndex,
          actionType: action.actionType as ActionType,
          status: 'failed',
          error,
        });
        return { success: false, error, payload: currentPayload, actionsLog, failedAtIndex: action.orderIndex };
      }

      try {
        const result = await actionHandler.execute(currentPayload, action.actionConfig);

        if (result.filtered) {
          actionsLog.push({
            orderIndex: action.orderIndex,
            actionType: action.actionType as ActionType,
            status: 'completed',
            result: { filtered: true, reason: result.filterReason },
          });
          return { success: false, filterReason: result.filterReason, payload: currentPayload, actionsLog, failedAtIndex: action.orderIndex };
        }

        actionsLog.push({
          orderIndex: action.orderIndex,
          actionType: action.actionType as ActionType,
          status: 'completed',
          result: result.data,
        });

        if (result.data) {
          currentPayload = result.data;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        actionsLog.push({
          orderIndex: action.orderIndex,
          actionType: action.actionType as ActionType,
          status: 'failed',
          error: errorMessage,
        });
        return { success: false, error: errorMessage, payload: currentPayload, actionsLog, failedAtIndex: action.orderIndex };
      }
    }

    return { success: true, payload: currentPayload, actionsLog };
  }
}

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

  const executionResult = await PipelineExecutor.executeActions(job.payload, pipeline.actions);

  if (!executionResult.success) {
    const failReason = executionResult.filterReason || executionResult.error || 'Execution failed';
    await jobRepository.markFailed(
      jobId,
      failReason,
      { 
        actionType: pipeline.actions.find((a: any) => a.orderIndex === executionResult.failedAtIndex)?.actionType, 
        orderIndex: executionResult.failedAtIndex 
      },
      executionResult.failedAtIndex!,
      executionResult.actionsLog
    );
    return;
  }

  await jobRepository.markCompleted(jobId, executionResult.payload, executionResult.actionsLog);
  await deliverToSubscribers(jobId, pipeline.subscribers, executionResult.payload);
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

async function isSafeUrl(targetUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(targetUrl);
    
    if (['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
      return false;
    }
    
    const lookup = await dns.lookup(parsed.hostname);
    const ip = lookup.address;
    
    if (
      ip.startsWith('127.') || 
      ip.startsWith('10.') || 
      ip.startsWith('192.168.') || 
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
    ) {
      return false;
    }
    
    if (ip === '::1' || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
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
