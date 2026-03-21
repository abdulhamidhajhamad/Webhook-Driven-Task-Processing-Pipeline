import { Request, Response } from 'express';
import { jobRepository } from '../../modules/jobs/job.repository';
import { JobStatus } from '../../core/types';
import { catchAsync } from '../../core/utils/catchAsync';
import { AppError } from '../../core/errors/AppError';

interface JobParams {
  id: string;
}

interface JobQuery {
  pipeline_id?: string;
  status?: string;
}

export const jobController = {
  getAll: catchAsync(async (req: Request<{}, {}, {}, JobQuery>, res: Response): Promise<void> => {
    const filters: { pipelineId?: string; status?: JobStatus } = {};

    if (req.query.pipeline_id) {
      filters.pipelineId = req.query.pipeline_id;
    }

    if (req.query.status) {
      filters.status = req.query.status as JobStatus;
    }

    const jobs = await jobRepository.findAll(filters);
    res.status(200).json(jobs);
  }),

  getById: catchAsync(async (req: Request<JobParams>, res: Response): Promise<void> => {
    const job = await jobRepository.findByIdWithDeliveries(req.params.id);

    if (!job) {
      throw new AppError('Job not found', 404);
    }

    res.status(200).json(job);
  }),
};