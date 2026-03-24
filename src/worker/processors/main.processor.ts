import { jobRepository } from '../../modules/jobs/job.repository';
import { pipelineRepository } from '../../modules/pipelines/pipeline.repository';
import { actions } from '../../actions';
import { ActionLog, ActionType } from '../../core/types';
import { deliverWithRetry } from './retry.processor';
import { isSafeUrl } from '../../core/utils/url-safety';

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

  await jobRepository.markProcessing(jobId);

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
    const isSafe = await isSafeUrl(subscriber.url);
    if (!isSafe) {
      console.error(`Blocked unsafe URL for delivery: ${subscriber.url}`);
      continue;
    }
    await deliverWithRetry(jobId, subscriber, payload, 0);
  }
}
