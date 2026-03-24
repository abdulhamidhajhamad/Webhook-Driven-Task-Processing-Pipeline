import { runSweepCycle } from '../processors/sweep.processor';

export function setupSweepWorker(): void {
  const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  console.log('[Sweep Worker] Initialized. Running every 5 minutes.');

  runSweepCycle();

  setInterval(() => {
    runSweepCycle();
  }, SWEEP_INTERVAL_MS);
}
