import { Router } from 'express';
import { pipelineController } from '../controllers/pipeline.controller';

export const pipelineRoutes = Router();

pipelineRoutes.post('/', pipelineController.create);
pipelineRoutes.get('/', pipelineController.getAll);
pipelineRoutes.get('/:id', pipelineController.getById);
pipelineRoutes.put('/:id', pipelineController.update);
pipelineRoutes.delete('/:id', pipelineController.remove);