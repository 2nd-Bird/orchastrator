import { WorkerManager } from '../core/WorkerManager';

export function cleanupCommand(
  repoRoot: string,
  repoName: string,
  force: boolean = false,
  deleteBranches: boolean = true
): void {
  if (!force) {
    console.error('Error: --force flag required for cleanup');
    console.error('This will remove all tmux sessions and worktrees');
    process.exit(1);
  }

  const workerManager = new WorkerManager(repoRoot, repoName);

  try {
    workerManager.cleanup(deleteBranches, force);
    console.log('Cleanup complete');
  } catch (error) {
    console.error(`Failed to cleanup: ${error}`);
    process.exit(1);
  }
}
