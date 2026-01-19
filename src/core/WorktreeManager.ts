import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface WorktreeInfo {
  path: string;
  branch: string;
}

export class WorktreeManager {
  private worktreeBaseDir: string;

  constructor(private repoRoot: string) {
    this.worktreeBaseDir = path.join(repoRoot, '.codex-agent', 'worktrees');
    if (!fs.existsSync(this.worktreeBaseDir)) {
      fs.mkdirSync(this.worktreeBaseDir, { recursive: true });
    }
  }

  createWorktree(taskId: string): WorktreeInfo {
    const worktreePath = path.join(this.worktreeBaseDir, taskId);
    const branchName = `codex/${taskId}`;

    if (fs.existsSync(worktreePath)) {
      throw new Error(`Worktree already exists: ${worktreePath}`);
    }

    // Check if branch already exists and delete it if so
    if (this.branchExists(branchName)) {
      try {
        execSync(`git branch -D ${branchName}`, {
          cwd: this.repoRoot,
          stdio: 'pipe',
        });
      } catch (error) {
        // Ignore errors if branch doesn't exist
      }
    }

    try {
      // Create worktree with a new branch from current HEAD
      execSync(`git worktree add -b ${branchName} "${worktreePath}"`, {
        cwd: this.repoRoot,
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Failed to create worktree: ${error}`);
    }

    return {
      path: worktreePath,
      branch: branchName,
    };
  }

  removeWorktree(taskId: string, deleteBranch: boolean = false, force: boolean = false): void {
    const worktreePath = path.join(this.worktreeBaseDir, taskId);
    const branchName = `codex/${taskId}`;

    if (!fs.existsSync(worktreePath)) {
      // Worktree doesn't exist, but maybe the branch does
      if (deleteBranch && this.branchExists(branchName)) {
        this.deleteBranch(branchName, force);
      }
      return;
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

    // Delete the branch if requested
    if (deleteBranch && this.branchExists(branchName)) {
      this.deleteBranch(branchName, force);
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
      // Get regular diffstat for tracked modifications (SPEC R9)
      const diffstat = execSync('git diff --stat HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      // Get untracked files (SPEC R9: diff includes untracked)
      const status = execSync('git status --porcelain', {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      // Parse untracked files from status output
      const untrackedFiles: string[] = [];
      const statusLines = status.split('\n');
      for (const line of statusLines) {
        if (line.startsWith('??')) {
          untrackedFiles.push(line);
        }
      }

      // Combine diffstat with untracked files
      let result = diffstat;

      if (untrackedFiles.length > 0) {
        // Add untracked files section
        if (result && !result.endsWith('\n')) {
          result += '\n';
        }
        if (result.trim()) {
          result += '\n';
        }
        result += 'Untracked files:\n';
        for (const file of untrackedFiles) {
          result += `  ${file}\n`;
        }
      }

      // If only untracked files exist (no tracked changes), show them anyway
      if (!diffstat.trim() && untrackedFiles.length > 0) {
        result = 'Untracked files:\n';
        for (const file of untrackedFiles) {
          result += `  ${file}\n`;
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to get diffstat: ${error}`);
    }
  }

  private branchExists(branchName: string): boolean {
    try {
      execSync(`git rev-parse --verify ${branchName}`, {
        cwd: this.repoRoot,
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  private deleteBranch(branchName: string, force: boolean = false): void {
    try {
      const forceFlag = force ? '-D' : '-d';
      execSync(`git branch ${forceFlag} ${branchName}`, {
        cwd: this.repoRoot,
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Failed to delete branch ${branchName}: ${error}`);
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

  listCodexBranches(): string[] {
    try {
      const output = execSync('git branch --list "codex/*"', {
        cwd: this.repoRoot,
        encoding: 'utf-8',
      });

      return output
        .split('\n')
        .map(line => line.trim().replace(/^\*\s*/, ''))
        .filter(line => line.startsWith('codex/'));
    } catch (error) {
      return [];
    }
  }

  removeAllWorktrees(deleteBranches: boolean = false, force: boolean = false): void {
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

    // Delete all codex/* branches if requested
    if (deleteBranches) {
      const branches = this.listCodexBranches();
      for (const branch of branches) {
        try {
          this.deleteBranch(branch, force);
        } catch (error) {
          console.error(`Failed to delete branch ${branch}: ${error}`);
        }
      }
    }
  }
}
