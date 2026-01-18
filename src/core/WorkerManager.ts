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

        // Write task content to a temporary file in the worktree to avoid shell escaping issues
        const taskFilePath = path.join(worktreeInfo.path, '.task-prompt.md');
        fs.writeFileSync(taskFilePath, taskContent, 'utf-8');

        // Create .gitignore in worktree to exclude .task-prompt.md
        // (worktrees have .git as a file, not a directory, so we can't use .git/info/exclude)
        const gitignorePath = path.join(worktreeInfo.path, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
          fs.writeFileSync(gitignorePath, '.task-prompt.md\n');
        } else {
          const existingGitignore = fs.readFileSync(gitignorePath, 'utf-8');
          if (!existingGitignore.includes('.task-prompt.md')) {
            fs.appendFileSync(gitignorePath, '\n.task-prompt.md\n');
          }
        }

        // Create tmux session with just a shell first
        this.tmux.createSession(task.id, worktreeInfo.path, '');

        // Use stdin redirection for safe task execution (SPEC R1: file-based invocation)
        // This avoids all shell escaping issues with quotes, backticks, and special characters
        // Use workspace-write sandbox mode to allow file modifications (SPEC R5: not read-only)
        const command = 'codex exec --sandbox workspace-write < .task-prompt.md';
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

        // Copy task file to run directory
        this.saveTaskFile(runId, task.id, taskContent);
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

  captureLogs(workerId: string, lines?: number): string {
    const state = this.state.load();
    if (!state) {
      throw new Error('No active orchestrator state found');
    }

    const worker = state.workers.find(w => w.id === workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    const logs = this.tmux.capturePane(workerId, lines);
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

    this.tmux.sendKeys(workerId, instruction);
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
