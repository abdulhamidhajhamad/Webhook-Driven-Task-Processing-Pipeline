import { Request, Response } from 'express';
import { db } from '../../core/db';
import { pipelineRepository } from '../../modules/pipelines/pipeline.repository';
import { jobRepository } from '../../modules/jobs/job.repository';
import { verifySignature } from '../../core/utils/crypto';

interface WebhookParams {
  sourceToken: string;
}

export const webhookController = {
  async receive(req: Request<WebhookParams>, res: Response): Promise<void> {
    try {
      const { sourceToken } = req.params;

      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        res.status(400).json({ error: 'Payload must be a valid JSON object' });
        return;
      }

      const pipeline = await pipelineRepository.findByToken(sourceToken);
      if (!pipeline) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }

      if (pipeline.secret) {
        const signature = req.headers['x-webhook-signature'] as string;
        if (!signature) {
          res.status(401).json({ error: 'Missing webhook signature' });
          return;
        }

        const isValid = verifySignature(
          JSON.stringify(req.body),
          pipeline.secret,
          signature
        );

        if (!isValid) {
          res.status(401).json({ error: 'Invalid webhook signature' });
          return;
        }
      }

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const job = await jobRepository.create(
          { pipelineId: pipeline.id, payload: req.body },
          client
        );

        await client.query('COMMIT');

        res.status(202).json({
          jobId: job.id,
          status: job.status,
          message: 'Webhook received and queued for processing',
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};