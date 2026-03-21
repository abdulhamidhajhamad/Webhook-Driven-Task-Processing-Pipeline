import { db } from '../../core/db';
import { rabbitMQ } from '../../core/queue';
import { pipelineRepository } from '../pipelines/pipeline.repository';
import { jobRepository } from '../jobs/job.repository';
import { verifySignature } from '../../core/utils/crypto';
import { Job } from '../../core/types';
import { AppError } from '../../core/errors/AppError';

export interface ProcessWebhookResult {
  job: Job;
  isDuplicate: boolean;
}

export const webhookService = {
  async processWebhook(
    sourceToken: string,
    payload: Record<string, unknown>,
    rawBody: string,
    signature?: string,
    externalDeliveryId?: string
  ): Promise<ProcessWebhookResult> {
    const pipeline = await pipelineRepository.findByToken(sourceToken);
    if (!pipeline) {
      throw new AppError('Pipeline not found', 404);
    }

    if (pipeline.secret) {
      if (!signature) throw new AppError('Invalid webhook signature', 401);
      const isValid = verifySignature(rawBody, pipeline.secret, signature);
      if (!isValid) throw new AppError('Invalid webhook signature', 401);
    }

    const client = await db.connect();
    let job: Job;
    let isDuplicate: boolean;

    try {
      await client.query('BEGIN');

      const result = await jobRepository.create(
        { pipelineId: pipeline.id, payload, externalDeliveryId },
        client
      );

      job = result.job;
      isDuplicate = result.isDuplicate;

      await client.query('COMMIT');

    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }

    if (!isDuplicate) {
      try {
        await rabbitMQ.publish(job.id);
      } catch (error) {
        console.error(`Failed to publish job ${job.id} to queue:`, error);
      }
    }

    return { job, isDuplicate };
  },
};