import { db } from '../../core/db';
import { pipelineRepository } from './pipeline.repository';
import { AppError } from '../../core/errors/AppError';
import {
  CreatePipelineDto,
  PipelineWithDetails,
  Pipeline,
} from '../../core/types';

export const pipelineService = {
  async createPipeline(data: CreatePipelineDto): Promise<PipelineWithDetails> {
    if (!data.name || data.name.trim() === '') {
      throw new AppError('Pipeline name is required', 400);
    }

    if (!data.actions || data.actions.length === 0) {
      throw new AppError('Pipeline must have at least one action', 400);
    }

    if (!data.subscribers || data.subscribers.length === 0) {
      throw new AppError('Pipeline must have at least one subscriber', 400);
    }

    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const pipeline = await pipelineRepository.create(data, client);

      for (const action of data.actions) {
        await pipelineRepository.addAction(pipeline.id, action, client);
      }

      for (const url of data.subscribers) {
        await pipelineRepository.addSubscriber(pipeline.id, url, client);
      }

      await client.query('COMMIT');

      return (await pipelineRepository.findWithDetails(pipeline.id))!;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getPipeline(id: string): Promise<PipelineWithDetails> {
    const pipeline = await pipelineRepository.findWithDetails(id);
    if (!pipeline) throw new AppError('Pipeline not found', 404);
    return pipeline;
  },

  async getAllPipelines(): Promise<Pipeline[]> {
    return pipelineRepository.findAll();
  },

  async updatePipeline(
    id: string,
    data: Partial<Pick<Pipeline, 'name' | 'secret' | 'isActive'>>
  ): Promise<Pipeline> {
    const exists = await pipelineRepository.findById(id);
    if (!exists) throw new AppError('Pipeline not found', 404);

    const updated = await pipelineRepository.update(id, data,db);
    if (!updated) throw new AppError('Pipeline not found', 404);

    return updated;
  },

  async deletePipeline(id: string): Promise<void> {
    const exists = await pipelineRepository.findById(id);
    if (!exists) throw new AppError('Pipeline not found', 404);

    await pipelineRepository.delete(id, db);
  },
};