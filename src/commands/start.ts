import { WorkerManager } from '../core/WorkerManager';
import { TaskParser } from '../core/TaskParser';

export async function startCommand(
  repoRoot: string,
  repoName: string,
  manifestPath: string
): Promise<void> {
  console.log('Starting workers...');

  const taskParser = new TaskParser(repoRoot);
  const workerManager = new WorkerManager(repoRoot, repoName);

  try {
    // Parse and validate manifest
    const manifest = taskParser.parseManifest(manifestPath);
    taskParser.validateTasks(manifest.tasks);

    console.log(`Found ${manifest.tasks.length} tasks`);

    // Start workers
    const runId = await workerManager.startWorkers(manifest.tasks);

    console.log(`\nWorkers started successfully!`);
    console.log(`Run ID: ${runId}`);
    console.log('\nUse the following commands to monitor progress:');
    console.log('  codex-agent status           # Show all workers');
    console.log('  codex-agent logs <worker-id> # View worker logs');
    console.log('  codex-agent diff <worker-id> # View worker changes');
  } catch (error) {
    console.error(`Failed to start workers: ${error}`);
    process.exit(1);
  }
}
