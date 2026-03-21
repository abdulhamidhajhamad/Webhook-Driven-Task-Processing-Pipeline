import { Request, Response } from 'express';
import { webhookService } from '../../modules/webhooks/webhook.service';
import { catchAsync } from '../../core/utils/catchAsync';
import { AppError } from '../../core/errors/AppError';

interface WebhookParams {
  sourceToken: string;
}

type WebhookRequest = Request<WebhookParams> & { rawBody: string };

export const webhookController = {
  receive: catchAsync(async (req: WebhookRequest, res: Response): Promise<void> => {
    const { sourceToken } = req.params;
    const payload = req.body;
    const rawBody = req.rawBody;
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const externalDeliveryId = (
      req.headers['x-github-delivery'] ??
      req.headers['x-request-id'] ??
      req.headers['x-delivery-id']
    ) as string | undefined;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new AppError('Payload must be a valid JSON object', 400);
    }

    const { job, isDuplicate } = await webhookService.processWebhook(
      sourceToken,
      payload,
      rawBody,
      signature,
      externalDeliveryId
    );

    if (isDuplicate) {
      res.status(200).json({
        jobId: job.id,
        status: job.status,
        message: 'Duplicate webhook, already processed',
      });
      return;
    }

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      message: 'Webhook received and queued for processing',
    });
  }),
};