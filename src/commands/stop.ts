import { WorkerManager } from '../core/WorkerManager';

export function stopCommand(
  repoRoot: string,
  repoName: string,
  workerId?: string,
  force: boolean = false
): void {
  const workerManager = new WorkerManager(repoRoot, repoName);

  try {
    if (workerId) {
      workerManager.stopWorker(workerId);
      console.log(`Worker ${workerId} stopped`);
    } else {
      if (!force) {
        console.error('Error: --force flag required to stop all workers');
        process.exit(1);
      }
      workerManager.stopAllWorkers();
      console.log('All workers stopped');
    }
  } catch (error) {
    console.error(`Failed to stop worker(s): ${error}`);
    process.exit(1);
  }
}
