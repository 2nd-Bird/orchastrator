import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class WorktreeManager {
  private worktreeBaseDir: string;

  constructor(private repoRoot: string) {
    this.worktreeBaseDir = path.join(repoRoot, '.codex-agent', 'worktrees');
    if (!fs.existsSync(this.worktreeBaseDir)) {
      fs.mkdirSync(this.worktreeBaseDir, { recursive: true });
    }
  }

  createWorktree(taskId: string, branch?: string): string {
    const worktreePath = path.join(this.worktreeBaseDir, taskId);

    if (fs.existsSync(worktreePath)) {
      throw new Error(`Worktree already exists: ${worktreePath}`);
    }

    // Get current branch or commit
    const currentRef = branch || this.getCurrentBranch();

    try {
      // Create worktree from current branch/commit
      execSync(`git worktree add "${worktreePath}" ${currentRef}`, {
        cwd: this.repoRoot,
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Failed to create worktree: ${error}`);
    }

    return worktreePath;
  }

  removeWorktree(taskId: string, force: boolean = false): void {
    const worktreePath = path.join(this.worktreeBaseDir, taskId);

    if (!fs.existsSync(worktreePath)) {
      return; // Already removed or never existed
    }

    // Validate path containment
    if (!this.isPathContained(worktreePath)) {
      throw new Error(`Path not contained in worktree directory: ${worktreePath}`);
    }

    try {
      // Remove git worktree
      const forceFlag = force ? '--force' : '';
      execSync(`git worktree remove ${forceFlag} "${worktreePath}"`, {
        cwd: this.repoRoot,
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Failed to remove worktree: ${error}`);
    }
  }

  worktreeExists(taskId: string): boolean {
    const worktreePath = path.join(this.worktreeBaseDir, taskId);
    return fs.existsSync(worktreePath);
  }

  getDiff(taskId: string): string {
    const worktreePath = path.join(this.worktreeBaseDir, taskId);

    if (!fs.existsSync(worktreePath)) {
      throw new Error(`Worktree does not exist: ${worktreePath}`);
    }

    try {
      const diff = execSync('git diff HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });
      return diff;
    } catch (error) {
      throw new Error(`Failed to get diff: ${error}`);
    }
  }

  getDiffStat(taskId: string): string {
    const worktreePath = path.join(this.worktreeBaseDir, taskId);

    if (!fs.existsSync(worktreePath)) {
      throw new Error(`Worktree does not exist: ${worktreePath}`);
    }

    try {
      const diffstat = execSync('git diff --stat HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
      });
      return diffstat;
    } catch (error) {
      throw new Error(`Failed to get diffstat: ${error}`);
    }
  }

  private getCurrentBranch(): string {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.repoRoot,
        encoding: 'utf-8',
      }).trim();
      return branch;
    } catch (error) {
      // Fallback to HEAD if we can't get the branch name
      return 'HEAD';
    }
  }

  private isPathContained(targetPath: string): boolean {
    const normalized = path.normalize(targetPath);
    const base = path.normalize(this.worktreeBaseDir);
    return normalized.startsWith(base);
  }

  listWorktrees(): string[] {
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: this.repoRoot,
        encoding: 'utf-8',
      });

      const worktrees: string[] = [];
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          const worktreePath = line.substring('worktree '.length);
          if (worktreePath.includes('.codex-agent/worktrees/')) {
            worktrees.push(worktreePath);
          }
        }
      }
      return worktrees;
    } catch (error) {
      return [];
    }
  }

  removeAllWorktrees(force: boolean = false): void {
    const worktrees = this.listWorktrees();
    for (const worktreePath of worktrees) {
      try {
        const forceFlag = force ? '--force' : '';
        execSync(`git worktree remove ${forceFlag} "${worktreePath}"`, {
          cwd: this.repoRoot,
          stdio: 'pipe',
        });
      } catch (error) {
        console.error(`Failed to remove worktree ${worktreePath}: ${error}`);
      }
    }
  }
}
