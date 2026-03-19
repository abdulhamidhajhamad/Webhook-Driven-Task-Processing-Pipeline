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

    const pipeline = await pipelineRepository.create(data);

    await Promise.all(
      data.actions.map((action) =>
        pipelineRepository.addAction(pipeline.id, action)
      )
    );

    await Promise.all(
      data.subscribers.map((url) =>
        pipelineRepository.addSubscriber(pipeline.id, url)
      )
    );

    const result = await pipelineRepository.findWithDetails(pipeline.id);
    return result!;
  },

  async getPipeline(id: string): Promise<PipelineWithDetails> {
    const pipeline = await pipelineRepository.findWithDetails(id);
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }
    return pipeline;
  },

  async getAllPipelines(): Promise<Pipeline[]> {
    return pipelineRepository.findAll();
  },

  async updatePipeline(
    id: string,
    data: Partial<Pick<Pipeline, 'name' | 'secret' | 'is_active'>>
  ): Promise<Pipeline> {
    const exists = await pipelineRepository.findById(id);
    if (!exists) {
      throw new Error('Pipeline not found');
    }

    const updated = await pipelineRepository.update(id, data);
    return updated!;
  },

  async deletePipeline(id: string): Promise<void> {
    const exists = await pipelineRepository.findById(id);
    if (!exists) {
      throw new Error('Pipeline not found');
    }

    await pipelineRepository.delete(id);
  },
};