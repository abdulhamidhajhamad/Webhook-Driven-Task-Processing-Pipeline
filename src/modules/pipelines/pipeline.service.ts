import { db } from '../../core/db';
import { pipelineRepository } from './pipeline.repository';
import {
  CreatePipelineDto,
  PipelineWithDetails,
  Pipeline,
} from '../../core/types';

export const pipelineService = {
  async createPipeline(data: CreatePipelineDto): Promise<PipelineWithDetails> {
    if (!data.name || data.name.trim() === '') {
      throw new Error('Pipeline name is required');
    }

    if (!data.actions || data.actions.length === 0) {
      throw new Error('Pipeline must have at least one action');
    }

    if (!data.subscribers || data.subscribers.length === 0) {
      throw new Error('Pipeline must have at least one subscriber');
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
    if (!pipeline) throw new Error('Pipeline not found');
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
    if (!exists) throw new Error('Pipeline not found');

    const updated = await pipelineRepository.update(id, data,db);
    if (!updated) throw new Error('Pipeline not found');

    return updated;
  },

  async deletePipeline(id: string): Promise<void> {
    const exists = await pipelineRepository.findById(id);
    if (!exists) throw new Error('Pipeline not found');

    await pipelineRepository.delete(id, db);
  },
};