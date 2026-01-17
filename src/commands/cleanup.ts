import { WorkerManager } from '../core/WorkerManager';

export function cleanupCommand(
  repoRoot: string,
  repoName: string,
  force: boolean = false
): void {
  if (!force) {
    console.error('Error: --force flag required for cleanup');
    console.error('This will remove all tmux sessions and worktrees');
    process.exit(1);
  }

  const workerManager = new WorkerManager(repoRoot, repoName);

  try {
    workerManager.cleanup(force);
    console.log('Cleanup complete');
  } catch (error) {
    console.error(`Failed to cleanup: ${error}`);
    process.exit(1);
  }
}
