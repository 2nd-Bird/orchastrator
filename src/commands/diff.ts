import { WorkerManager } from '../core/WorkerManager';

export function diffCommand(
  repoRoot: string,
  repoName: string,
  workerId: string,
  statOnly: boolean = false
): void {
  const workerManager = new WorkerManager(repoRoot, repoName);

  try {
    const diff = workerManager.getDiff(workerId, statOnly);
    console.log(diff);
  } catch (error) {
    console.error(`Failed to get diff: ${error}`);
    process.exit(1);
  }
}
