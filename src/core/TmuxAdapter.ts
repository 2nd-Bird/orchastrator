import { execSync, spawn } from 'child_process';
import * as fs from 'fs';

export class TmuxAdapter {
  constructor(private repoName: string) {}

  private getSessionName(taskId: string): string {
    return `codex-${this.repoName}-${taskId}`;
  }

  sessionExists(taskId: string): boolean {
    try {
      const sessionName = this.getSessionName(taskId);
      execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
      return true;
    } catch {
      return false;
    }
  }

  createSession(taskId: string, worktreePath: string, command: string): void {
    const sessionName = this.getSessionName(taskId);

    if (this.sessionExists(taskId)) {
      throw new Error(`Tmux session already exists: ${sessionName}`);
    }

    // Create a detached tmux session
    execSync(`tmux new-session -d -s ${sessionName} -c "${worktreePath}"`);

    // Send the command to the session
    this.sendKeys(taskId, command);
  }

  sendKeys(taskId: string, keys: string): void {
    const sessionName = this.getSessionName(taskId);

    if (!this.sessionExists(taskId)) {
      throw new Error(`Tmux session does not exist: ${sessionName}`);
    }

    // Send keys followed by Enter
    execSync(`tmux send-keys -t ${sessionName} "${keys.replace(/"/g, '\\"')}" C-m`);
  }

  capturePane(taskId: string, lines?: number): string {
    const sessionName = this.getSessionName(taskId);

    if (!this.sessionExists(taskId)) {
      throw new Error(`Tmux session does not exist: ${sessionName}`);
    }

    if (lines !== undefined) {
      if (!Number.isInteger(lines) || lines <= 0) {
        throw new Error('Lines must be a positive integer');
      }
    }

    try {
      const command =
        lines !== undefined
          ? `tmux capture-pane -t ${sessionName} -p -S -${lines}`
          : `tmux capture-pane -t ${sessionName} -p`;
      const output = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      return output;
    } catch (error) {
      throw new Error(`Failed to capture pane: ${error}`);
    }
  }

  killSession(taskId: string): void {
    const sessionName = this.getSessionName(taskId);

    if (!this.sessionExists(taskId)) {
      return; // Already killed or never existed
    }

    try {
      execSync(`tmux kill-session -t ${sessionName}`);
    } catch (error) {
      throw new Error(`Failed to kill session: ${error}`);
    }
  }

  listSessions(): string[] {
    try {
      const output = execSync('tmux list-sessions -F "#{session_name}"', {
        encoding: 'utf-8',
      });
      return output
        .split('\n')
        .filter(line => line.trim())
        .filter(session => session.startsWith(`codex-${this.repoName}-`));
    } catch {
      return []; // No sessions exist
    }
  }

  killAllSessions(): void {
    const sessions = this.listSessions();
    for (const session of sessions) {
      try {
        execSync(`tmux kill-session -t ${session}`);
      } catch (error) {
        console.error(`Failed to kill session ${session}: ${error}`);
      }
    }
  }
}
