import { db } from '../../core/db';
import { pipelineRepository } from '../pipelines/pipeline.repository';
import { jobRepository } from '../jobs/job.repository';
import { verifySignature } from '../../core/utils/crypto';
import { Job } from '../../core/types';

export const webhookService = {
  async processWebhook(
    sourceToken: string,
    payload: Record<string, unknown>,
    rawBody: string,
    signature?: string
  ): Promise<Job> {
    const pipeline = await pipelineRepository.findByToken(sourceToken);
    if (!pipeline) {
      throw new Error('PIPELINE_NOT_FOUND');
    }

    if (pipeline.secret) {
      if (!signature) {
        throw new Error('INVALID_SIGNATURE');
      }

      const isValid = verifySignature(rawBody, pipeline.secret, signature);

      if (!isValid) {
        throw new Error('INVALID_SIGNATURE');
      }
    }

    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const job = await jobRepository.create(
        { pipelineId: pipeline.id, payload },
        client
      );

      await client.query('COMMIT');
      return job;

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
  },
};