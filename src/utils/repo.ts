import { execSync } from 'child_process';
import * as path from 'path';

export function getRepoRoot(): string {
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return root;
  } catch (error) {
    throw new Error('Not in a git repository');
  }
}

export function getRepoName(): string {
  try {
    const repoRoot = getRepoRoot();
    return path.basename(repoRoot);
  } catch (error) {
    throw new Error('Failed to get repository name');
  }
}

export function hasUncommittedChanges(): boolean {
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return status.length > 0;
  } catch (error) {
    return false;
  }
}

export function validateRepo(): { repoRoot: string; repoName: string } {
  try {
    const repoRoot = getRepoRoot();
    const repoName = getRepoName();

    if (hasUncommittedChanges()) {
      console.warn('Warning: Repository has uncommitted changes');
    }

    return { repoRoot, repoName };
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
