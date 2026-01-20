import * as fs from 'fs';
import * as path from 'path';
import { Task } from '../types';
import { TmuxAdapter } from './TmuxAdapter';
import { WorktreeManager } from './WorktreeManager';
import { StateStore } from './StateStore';
import { TaskParser } from './TaskParser';
import { OrchestratorState, WorkerState, RunSummary, WorkerArtifacts } from '../types';

export class WorkerManager {
  private tmux: TmuxAdapter;
  private worktree: WorktreeManager;
  private state: StateStore;
  private taskParser: TaskParser;

  constructor(
    private repoRoot: string,
    private repoName: string
  ) {
    this.tmux = new TmuxAdapter(repoName);
    this.worktree = new WorktreeManager(repoRoot);
    this.state = new StateStore(repoRoot);
    this.taskParser = new TaskParser(repoRoot);
  }

  async startWorkers(tasks: Task[]): Promise<string> {
    const runId = this.generateRunId();
    const startedAt = new Date().toISOString();

    const orchestratorState: OrchestratorState = {
      runId,
      repoRoot: this.repoRoot,
      repoName: this.repoName,
      startedAt,
      workers: [],
    };

    for (const task of tasks) {
      try {
        console.log(`Starting worker for task: ${task.id}`);

        // Create worktree with unique branch
        const worktreeInfo = this.worktree.createWorktree(task.id);

        // Read task file content
        const taskContent = this.taskParser.readTaskFile(task.file);

        // Save task file to run artifacts first (SPEC R7: no temp files in worktree)
        this.saveTaskFile(runId, task.id, taskContent);

        // Get absolute path to task file in artifacts directory
        const taskFilePath = path.join(this.getWorkerDir(runId, task.id), 'task.md');

        // Create tmux session with just a shell first
        this.tmux.createSession(task.id, worktreeInfo.path, '');

        // Use stdin redirection from artifact path for safe task execution (SPEC R1 + R7)
        // This avoids all shell escaping issues and doesn't pollute the worktree
        // Use workspace-write sandbox mode to allow file modifications (SPEC R5: not read-only)
        // Properly escape the path for shell
        const escapedPath = taskFilePath.replace(/'/g, "'\\''");
        const command = `codex exec --sandbox workspace-write < '${escapedPath}'`;
        this.tmux.sendKeys(task.id, command);

        // Save the executed command for debugging (SPEC R6: persist command)
        this.saveCommand(runId, task.id, command);

        const workerState: WorkerState = {
          id: task.id,
          taskId: task.id,
          taskFile: task.file,
          tmuxSession: `codex-${this.repoName}-${task.id}`,
          worktreePath: worktreeInfo.path,
          branch: worktreeInfo.branch,
          status: 'running',
          startedAt: new Date().toISOString(),
        };

        orchestratorState.workers.push(workerState);
      } catch (error) {
        console.error(`Failed to start worker ${task.id}: ${error}`);
        const workerState: WorkerState = {
          id: task.id,
          taskId: task.id,
          taskFile: task.file,
          tmuxSession: `codex-${this.repoName}-${task.id}`,
          worktreePath: '',
          branch: `codex/${task.id}`,
          status: 'failed',
          startedAt: new Date().toISOString(),
          stoppedAt: new Date().toISOString(),
        };
        orchestratorState.workers.push(workerState);
      }
    }

    this.state.save(orchestratorState);
    return runId;
  }

  getStatus(workerId?: string): WorkerState[] {
    const state = this.state.load();
    if (!state) {
      return [];
    }

    if (workerId) {
      const worker = state.workers.find(w => w.id === workerId);
      return worker ? [worker] : [];
    }

    return state.workers;
  }

  captureLogs(workerId: string, lines?: number, raw = false): string {
    const state = this.state.load();
    if (!state) {
      throw new Error('No active orchestrator state found');
    }

    const worker = state.workers.find(w => w.id === workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    const logs = this.tmux.capturePane(workerId, lines, raw);
    this.saveLogs(state.runId, workerId, logs);
    return logs;
  }

  getDiff(workerId: string, statOnly: boolean = false): string {
    const state = this.state.load();
    if (!state) {
      throw new Error('No active orchestrator state found');
    }

    const worker = state.workers.find(w => w.id === workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    if (statOnly) {
      const diffstat = this.worktree.getDiffStat(workerId);
      this.saveDiffStat(state.runId, workerId, diffstat);
      return diffstat;
    } else {
      const diff = this.worktree.getDiff(workerId);
      this.saveDiff(state.runId, workerId, diff);
      return diff;
    }
  }

  sendInstruction(workerId: string, instruction: string): void {
    const state = this.state.load();
    if (!state) {
      throw new Error('No active orchestrator state found');
    }

    const worker = state.workers.find(w => w.id === workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    // SPEC R8: Send guard - detect if Codex is running before sending instruction
    const recentOutput = this.tmux.capturePane(workerId, 20);

    if (!this.isCodexRunning(recentOutput)) {
      console.log(`Codex not running for worker ${workerId}, restarting...`);

      // Load the original command from artifacts
      const commandPath = path.join(
        this.repoRoot,
        '.codex-agent',
        'runs',
        state.runId,
        'workers',
        workerId,
        'command.txt'
      );

      if (fs.existsSync(commandPath)) {
        const originalCommand = fs.readFileSync(commandPath, 'utf-8').trim();
        this.tmux.sendKeys(workerId, originalCommand);

        // Wait briefly for Codex to start
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const waitTime = 2000; // 2 seconds
        console.log(`Waiting ${waitTime}ms for Codex to start...`);
        require('child_process').execSync(`sleep ${waitTime / 1000}`);
      } else {
        console.warn(`Command file not found at ${commandPath}, sending instruction anyway`);
      }
    }

    // Use literal mode to avoid shell parsing of special characters (SPEC R8)
    this.tmux.sendKeysLiteral(workerId, instruction);
  }

  private isCodexRunning(recentOutput: string): boolean {
    const lines = recentOutput.trim().split('\n');
    const lastLine = lines[lines.length - 1] || '';

    // Bash prompt patterns indicate Codex is not running
    if (lastLine.match(/\$\s*$/) || lastLine.match(/#\s*$/)) {
      return false;
    }

    // Codex still active if recent output mentions "Claude" or shows prompt
    if (recentOutput.includes('Claude') || recentOutput.includes('assistant>')) {
      return true;
    }

    // Conservative: assume not running if we can't determine
    return false;
  }

  stopWorker(workerId: string): void {
    const state = this.state.load();
    if (!state) {
      throw new Error('No active orchestrator state found');
    }

    const worker = state.workers.find(w => w.id === workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    // Send Ctrl+C to stop the worker
    this.tmux.sendKeys(workerId, '\x03');

    // Update worker status
    worker.status = 'stopped';
    worker.stoppedAt = new Date().toISOString();
    this.state.save(state);
  }

  stopAllWorkers(): void {
    const state = this.state.load();
    if (!state) {
      throw new Error('No active orchestrator state found');
    }

    for (const worker of state.workers) {
      try {
        if (worker.status === 'running') {
          this.stopWorker(worker.id);
        }
      } catch (error) {
        console.error(`Failed to stop worker ${worker.id}: ${error}`);
      }
    }
  }

  cleanup(deleteBranches: boolean = true, force: boolean = false): void {
    const state = this.state.load();
    if (!state) {
      console.log('No active orchestrator state found');
      return;
    }

    // Kill all tmux sessions
    this.tmux.killAllSessions();

    // Remove all worktrees and optionally delete branches
    this.worktree.removeAllWorktrees(deleteBranches, force);

    // Clear state
    this.state.clear();

    console.log('Cleanup complete');
  }

  private generateRunId(): string {
    return `run-${Date.now()}`;
  }

  private getRunDir(runId: string): string {
    const runDir = path.join(this.repoRoot, '.codex-agent', 'runs', runId);
    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }
    return runDir;
  }

  private getWorkerDir(runId: string, workerId: string): string {
    const workerDir = path.join(this.getRunDir(runId), 'workers', workerId);
    if (!fs.existsSync(workerDir)) {
      fs.mkdirSync(workerDir, { recursive: true });
    }
    return workerDir;
  }

  private saveTaskFile(runId: string, workerId: string, content: string): void {
    const workerDir = this.getWorkerDir(runId, workerId);
    const taskFilePath = path.join(workerDir, 'task.md');
    fs.writeFileSync(taskFilePath, content, 'utf-8');
  }

  private saveLogs(runId: string, workerId: string, logs: string): void {
    const workerDir = this.getWorkerDir(runId, workerId);
    const logsPath = path.join(workerDir, 'logs.txt');
    fs.writeFileSync(logsPath, logs, 'utf-8');
  }

  private saveDiff(runId: string, workerId: string, diff: string): void {
    const workerDir = this.getWorkerDir(runId, workerId);
    const diffPath = path.join(workerDir, 'diff.patch');
    fs.writeFileSync(diffPath, diff, 'utf-8');
  }

  private saveDiffStat(runId: string, workerId: string, diffstat: string): void {
    const workerDir = this.getWorkerDir(runId, workerId);
    const diffstatPath = path.join(workerDir, 'diffstat.txt');
    fs.writeFileSync(diffstatPath, diffstat, 'utf-8');
  }

  private saveCommand(runId: string, workerId: string, command: string): void {
    const workerDir = this.getWorkerDir(runId, workerId);
    const commandPath = path.join(workerDir, 'command.txt');
    fs.writeFileSync(commandPath, command, 'utf-8');
  }
}
