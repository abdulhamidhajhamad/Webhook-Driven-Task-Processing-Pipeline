import { Request, Response } from 'express';
import { pipelineService } from '../../modules/pipelines/pipeline.service';
interface PipelineParams {
  id: string;
}
export const pipelineController = {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const pipeline = await pipelineService.createPipeline(req.body);
      res.status(201).json(pipeline);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  },

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const pipelines = await pipelineService.getAllPipelines();
      res.status(200).json(pipelines);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getById(req: Request<PipelineParams>, res: Response): Promise<void> {
    try {
      const pipeline = await pipelineService.getPipeline(req.params.id);
      res.status(200).json(pipeline);
    } catch (error) {
      if (error instanceof Error && error.message === 'Pipeline not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  },

  async update(req: Request<PipelineParams>, res: Response): Promise<void> {
    try {
      const pipeline = await pipelineService.updatePipeline(
        req.params.id,
        req.body
      );
      res.status(200).json(pipeline);
    } catch (error) {
      if (error instanceof Error && error.message === 'Pipeline not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  },

  async remove(req: Request<PipelineParams>, res: Response): Promise<void> {
    try {
      await pipelineService.deletePipeline(req.params.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'Pipeline not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  },
};