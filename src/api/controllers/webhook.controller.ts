import { Request, Response } from 'express';
import { webhookService } from '../../modules/webhooks/webhook.service';

interface WebhookParams {
  sourceToken: string;
}

type WebhookRequest = Request<WebhookParams> & { rawBody: string };

export const webhookController = {
  async receive(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const { sourceToken } = req.params;
      const payload = req.body;
      const rawBody = req.rawBody;
      const signature = req.headers['x-webhook-signature'] as string | undefined;

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        res.status(400).json({ error: 'Payload must be a valid JSON object' });
        return;
      }

      const job = await webhookService.processWebhook(
        sourceToken,
        payload,
        rawBody,
        signature
      );

      res.status(202).json({
        jobId: job.id,
        status: job.status,
        message: 'Webhook received and queued for processing',
      });

    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'PIPELINE_NOT_FOUND') {
          res.status(404).json({ error: 'Pipeline not found' });
          return;
        }
        if (error.message === 'INVALID_SIGNATURE') {
          res.status(401).json({ error: 'Invalid webhook signature' });
          return;
        }
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};