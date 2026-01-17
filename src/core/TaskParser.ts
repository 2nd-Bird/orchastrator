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
      throw new Error('Invalid manifest: missing or invalid "tasks" array');
    }

    for (const task of manifest.tasks) {
      if (!task.id || !task.file) {
        throw new Error('Invalid task: missing "id" or "file" field');
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
    for (const task of tasks) {
      if (ids.has(task.id)) {
        throw new Error(`Duplicate task ID: ${task.id}`);
      }
      ids.add(task.id);

      const fullPath = path.isAbsolute(task.file)
        ? task.file
        : path.join(this.repoRoot, task.file);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`Task file not found: ${fullPath} (task: ${task.id})`);
      }
    }
  }
}
