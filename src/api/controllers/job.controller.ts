import { Request, Response } from 'express';
import { jobRepository } from '../../modules/jobs/job.repository';
import { JobStatus } from '../../core/types';

interface JobParams {
  id: string;
}

interface JobQuery {
  pipeline_id?: string;
  status?: string;
}

export const jobController = {
  async getAll(req: Request<{}, {}, {}, JobQuery>, res: Response): Promise<void> {
    try {
      const filters: { pipelineId?: string; status?: JobStatus } = {};

      if (req.query.pipeline_id) {
        filters.pipelineId = req.query.pipeline_id;
      }

      if (req.query.status) {
        filters.status = req.query.status as JobStatus;
      }

      const jobs = await jobRepository.findAll(filters);
      res.status(200).json(jobs);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getById(req: Request<JobParams>, res: Response): Promise<void> {
    try {
      const job = await jobRepository.findByIdWithDeliveries(req.params.id);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.status(200).json(job);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};