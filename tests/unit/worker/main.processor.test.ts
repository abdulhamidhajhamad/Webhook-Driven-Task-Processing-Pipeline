import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { processJob } from '../../../src/worker/processors/main.processor';
import { jobRepository } from '../../../src/modules/jobs/job.repository';
import { pipelineRepository } from '../../../src/modules/pipelines/pipeline.repository';
import { deliverWithRetry } from '../../../src/worker/processors/retry.processor';
import { actions } from '../../../src/actions';

vi.mock('../../../src/modules/jobs/job.repository', () => ({
  jobRepository: {
    findById: vi.fn(),
    markProcessing: vi.fn(),
    markFailed: vi.fn(),
    markCompleted: vi.fn(),
  },
}));

vi.mock('../../../src/modules/pipelines/pipeline.repository', () => ({
  pipelineRepository: {
    findWithDetails: vi.fn(),
  },
}));

vi.mock('../../../src/worker/processors/retry.processor', () => ({
  deliverWithRetry: vi.fn(),
}));

vi.mock('../../../src/actions', () => ({
  actions: {
    'custom-action': {
      execute: vi.fn(),
    },
  },
}));

describe('Main Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ignore process if job is not found', async () => {
    (jobRepository.findById as Mock).mockResolvedValueOnce(null);

    await processJob('non-existent-job');

    expect(jobRepository.findById).toHaveBeenCalledWith('non-existent-job');
    expect(jobRepository.markProcessing).not.toHaveBeenCalled();
  });

  it('should mark job failed if pipeline is not found', async () => {
    const mockJob = { id: 'job-1', pipelineId: 'pipeline-1', payload: {} };
    (jobRepository.findById as Mock).mockResolvedValueOnce(mockJob);
    (pipelineRepository.findWithDetails as Mock).mockResolvedValueOnce(null);

    await processJob('job-1');

    expect(jobRepository.markProcessing).toHaveBeenCalledWith('job-1');
    expect(pipelineRepository.findWithDetails).toHaveBeenCalledWith('pipeline-1');
    expect(jobRepository.markFailed).toHaveBeenCalledWith(
        'job-1',
        'Pipeline not found',
        { reason: 'Pipeline was deleted or deactivated' },
        0,
        []
    );
  });

  it('should process job correctly when pipeline runs without issues', async () => {
    const mockJob = { id: 'job-2', pipelineId: 'pipeline-2', payload: { data: 'init' } };
    const mockPipeline = {
      id: 'pipeline-2',
      actions: [
        { actionType: 'custom-action', orderIndex: 1, actionConfig: {} }
      ],
      subscribers: [
        { id: 'sub-1', url: 'http://test' }
      ]
    };

    (jobRepository.findById as Mock).mockResolvedValueOnce(mockJob);
    (pipelineRepository.findWithDetails as Mock).mockResolvedValueOnce(mockPipeline);
    
    (actions['custom-action'].execute as Mock).mockResolvedValue({ filtered: false, data: { data: 'modified' } });

    await processJob('job-2');

    expect(jobRepository.markCompleted).toHaveBeenCalledWith(
        'job-2',
        { data: 'modified' },
        expect.any(Array) 
    );
    
    expect(deliverWithRetry).toHaveBeenCalledWith(
        'job-2', 
        { id: 'sub-1', url: 'http://test' }, 
        { data: 'modified' }, 
        0 
    );
  });

  it('should mark failed if an action throws an error during execution', async () => {
    const mockJob = { id: 'job-3', pipelineId: 'pipeline-3', payload: {} };
    const mockPipeline = {
      actions: [
        { actionType: 'custom-action', orderIndex: 1, actionConfig: {} }
      ],
      subscribers: []
    };

    (jobRepository.findById as Mock).mockResolvedValueOnce(mockJob);
    (pipelineRepository.findWithDetails as Mock).mockResolvedValueOnce(mockPipeline);
    
   
    (actions['custom-action'].execute as Mock).mockRejectedValue(new Error('Syntax error parsing body'));

    await processJob('job-3');

    
    expect(jobRepository.markCompleted).not.toHaveBeenCalled();
    expect(deliverWithRetry).not.toHaveBeenCalled();

    
    expect(jobRepository.markFailed).toHaveBeenCalledWith(
        'job-3',
        'Syntax error parsing body', 
        expect.objectContaining({ actionType: 'custom-action', orderIndex: 1 }), // fail reason
        1, 
        expect.any(Array) 
    );
  });
});