import { WorkerManager } from '../core/WorkerManager';

export function sendCommand(
  repoRoot: string,
  repoName: string,
  workerId: string,
  instruction: string
): void {
  const workerManager = new WorkerManager(repoRoot, repoName);

  try {
    workerManager.sendInstruction(workerId, instruction);
    console.log(`Instruction sent to worker ${workerId}`);
  } catch (error) {
    console.error(`Failed to send instruction: ${error}`);
    process.exit(1);
  }
}
