import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

export const webhookRoutes = Router();

webhookRoutes.post('/:sourceToken', webhookController.receive);