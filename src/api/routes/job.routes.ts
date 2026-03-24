import { Router } from 'express';
import { jobController } from '../controllers/job.controller';

export const jobRoutes = Router();

jobRoutes.get('/', jobController.getAll);
jobRoutes.get('/:id', jobController.getById);