export interface Task {
  id: string;
  file: string;
  description?: string;
}

export interface TaskManifest {
  tasks: Task[];
}

export interface WorkerState {
  id: string;
  taskId: string;
  taskFile: string;
  tmuxSession: string;
  worktreePath: string;
  status: 'starting' | 'running' | 'stopped' | 'failed';
  startedAt: string;
  stoppedAt?: string;
}

export interface OrchestratorState {
  runId: string;
  repoRoot: string;
  repoName: string;
  startedAt: string;
  workers: WorkerState[];
}

export interface WorkerArtifacts {
  taskFile: string;
  logs: string;
  diff: string;
  diffstat: string;
}

export interface RunSummary {
  runId: string;
  startedAt: string;
  completedAt?: string;
  workers: {
    [taskId: string]: {
      status: string;
      artifacts: WorkerArtifacts;
    };
  };
}
