import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { Task, TaskManifest } from '../types';

export class TaskParser {
  constructor(private repoRoot: string) {}

  parseManifest(manifestPath: string): TaskManifest {
    const fullPath = path.isAbsolute(manifestPath)
      ? manifestPath
      : path.join(this.repoRoot, manifestPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Task manifest not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const manifest = YAML.parse(content) as TaskManifest;

    if (!manifest.tasks || !Array.isArray(manifest.tasks)) {
      throw new Error(
        `Invalid manifest: missing or invalid "tasks" array\n` +
        `Manifest path: ${fullPath}\n` +
        `Repo root: ${this.repoRoot}`
      );
    }

    // Validate required fields with detailed error messages (SPEC R3)
    for (let i = 0; i < manifest.tasks.length; i++) {
      const task = manifest.tasks[i];
      if (!task.id) {
        throw new Error(
          `Invalid task at index ${i}: missing required "id" field\n` +
          `Manifest: ${fullPath}\n` +
          `Task: ${JSON.stringify(task, null, 2)}`
        );
      }
      if (!task.file) {
        throw new Error(
          `Invalid task at index ${i}: missing required "file" field\n` +
          `Task ID: ${task.id}\n` +
          `Manifest: ${fullPath}\n` +
          `Repo root: ${this.repoRoot}`
        );
      }
    }

    return manifest;
  }

  readTaskFile(taskFilePath: string): string {
    const fullPath = path.isAbsolute(taskFilePath)
      ? taskFilePath
      : path.join(this.repoRoot, taskFilePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Task file not found: ${fullPath}`);
    }

    return fs.readFileSync(fullPath, 'utf-8');
  }

  validateTasks(tasks: Task[]): void {
    const ids = new Set<string>();
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      if (ids.has(task.id)) {
        throw new Error(
          `Duplicate task ID: ${task.id}\n` +
          `Task index: ${i}\n` +
          `Repo root: ${this.repoRoot}`
        );
      }
      ids.add(task.id);

      // Resolve path relative to repo root (SPEC R2: canonicalization)
      const fullPath = path.isAbsolute(task.file)
        ? task.file
        : path.join(this.repoRoot, task.file);

      if (!fs.existsSync(fullPath)) {
        throw new Error(
          `Task file not found\n` +
          `Task ID: ${task.id}\n` +
          `Task index: ${i}\n` +
          `Resolved path: ${fullPath}\n` +
          `Original path: ${task.file}\n` +
          `Repo root: ${this.repoRoot}`
        );
      }
    }
  }
}
