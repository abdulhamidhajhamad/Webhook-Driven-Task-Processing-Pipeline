import { jobRepository } from '../../modules/jobs/job.repository';
import { rabbitMQ } from '../../core/queue';

export async function runSweepCycle(): Promise<void> {
  try {
    console.log('[Sweep Worker] Scanning for stalled jobs...');
    const stalledJobs = await jobRepository.getStalledPendingJobs(15, 100);

    if (stalledJobs.length === 0) {
      return;
    }

    console.log(`[Sweep Worker] Found ${stalledJobs.length} stalled jobs. Re-queuing...`);

    for (const job of stalledJobs) {
      await rabbitMQ.publish(job.id);
    }

    console.log(`[Sweep Worker] Successfully re-queued ${stalledJobs.length} stalled jobs.`);
  } catch (error) {
    console.error('[Sweep Worker] Error during sweep cycle:', error);
  }
}

