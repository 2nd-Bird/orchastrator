import { WorkerManager } from '../core/WorkerManager';

export function logsCommand(
  repoRoot: string,
  repoName: string,
  workerId: string,
  lines?: number,
  raw = false
): void {
  const workerManager = new WorkerManager(repoRoot, repoName);

  try {
    const logs = workerManager.captureLogs(workerId, lines, raw);
    console.log(logs);
  } catch (error) {
    console.error(`Failed to capture logs: ${error}`);
    process.exit(1);
  }
}
