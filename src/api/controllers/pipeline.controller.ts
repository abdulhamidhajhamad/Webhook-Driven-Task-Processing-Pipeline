import { Request, Response } from 'express';
import { pipelineService } from '../../modules/pipelines/pipeline.service';
import { catchAsync } from '../../core/utils/catchAsync';

interface PipelineParams {
  id: string;
}

export const pipelineController = {
  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const pipeline = await pipelineService.createPipeline(req.body);
    res.status(201).json(pipeline);
  }),

  getAll: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const pipelines = await pipelineService.getAllPipelines();
    res.status(200).json(pipelines);
  }),

  getById: catchAsync(async (req: Request<PipelineParams>, res: Response): Promise<void> => {
    const pipeline = await pipelineService.getPipeline(req.params.id);
    res.status(200).json(pipeline);
  }),

  update: catchAsync(async (req: Request<PipelineParams>, res: Response): Promise<void> => {
    const pipeline = await pipelineService.updatePipeline(req.params.id, req.body);
    res.status(200).json(pipeline);
  }),

  remove: catchAsync(async (req: Request<PipelineParams>, res: Response): Promise<void> => {
    await pipelineService.deletePipeline(req.params.id);
    res.status(204).send();
  }),
};