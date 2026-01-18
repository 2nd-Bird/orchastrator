import { WorkerManager } from '../core/WorkerManager';

export function statusCommand(
  repoRoot: string,
  repoName: string,
  workerId?: string,
  jsonOutput = false
): void {
  const workerManager = new WorkerManager(repoRoot, repoName);

  try {
    const workers = workerManager.getStatus(workerId);

    if (jsonOutput) {
      const payload = workers.map((worker) => ({
        id: worker.id,
        status: worker.status,
        tmuxSession: worker.tmuxSession,
        worktreePath: worker.worktreePath,
        taskFile: worker.taskFile,
      }));
      console.log(JSON.stringify(payload));
      return;
    }

    if (workers.length === 0) {
      console.log('No workers found');
      return;
    }

    console.log('\nWorker Status:\n');
    for (const worker of workers) {
      console.log(`ID:           ${worker.id}`);
      console.log(`Task:         ${worker.taskFile}`);
      console.log(`Status:       ${worker.status}`);
      console.log(`Branch:       ${worker.branch}`);
      console.log(`Tmux Session: ${worker.tmuxSession}`);
      console.log(`Worktree:     ${worker.worktreePath}`);
      console.log(`Started:      ${worker.startedAt}`);
      if (worker.stoppedAt) {
        console.log(`Stopped:      ${worker.stoppedAt}`);
      }
      console.log('---');
    }
  } catch (error) {
    console.error(`Failed to get status: ${error}`);
    process.exit(1);
  }
}
