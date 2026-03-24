import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { runSweepCycle } from '../../../src/worker/processors/sweep.processor';
import { jobRepository } from '../../../src/modules/jobs/job.repository';
import { rabbitMQ } from '../../../src/core/queue';


vi.mock('../../../src/modules/jobs/job.repository', () => ({
  jobRepository: {
    getStalledPendingJobs: vi.fn(),
  },
}));

vi.mock('../../../src/core/queue', () => ({
  rabbitMQ: {
    publish: vi.fn(),
  },
}));

describe('Sweep Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not publish anything if no stalled jobs are found', async () => {
    (jobRepository.getStalledPendingJobs as Mock).mockResolvedValueOnce([]);

    await runSweepCycle();

    expect(jobRepository.getStalledPendingJobs).toHaveBeenCalledWith(15, 100);
    expect(rabbitMQ.publish).not.toHaveBeenCalled();
  });

  it('should republish stalled jobs to RabbitMQ', async () => {
    const mockStalledJobs = [
      { id: 'job-1' },
      { id: 'job-2' }
    ];
    (jobRepository.getStalledPendingJobs as Mock).mockResolvedValueOnce(mockStalledJobs);

    await runSweepCycle();

    expect(jobRepository.getStalledPendingJobs).toHaveBeenCalledWith(15, 100);
    expect(rabbitMQ.publish).toHaveBeenCalledTimes(2);
    expect(rabbitMQ.publish).toHaveBeenCalledWith('job-1');
    expect(rabbitMQ.publish).toHaveBeenCalledWith('job-2');
  });

  it('should handle errors gracefully during the sweep cycle', async () => {
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    (jobRepository.getStalledPendingJobs as Mock).mockRejectedValueOnce(new Error('Database error'));

    await expect(runSweepCycle()).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
        '[Sweep Worker] Error during sweep cycle:', 
        expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
});
