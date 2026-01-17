import * as fs from 'fs';
import * as path from 'path';
import { OrchestratorState } from '../types';

export class StateStore {
  private statePath: string;

  constructor(private repoRoot: string) {
    const stateDir = path.join(repoRoot, '.codex-agent');
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    this.statePath = path.join(stateDir, 'state.json');
  }

  load(): OrchestratorState | null {
    if (!fs.existsSync(this.statePath)) {
      return null;
    }
    const content = fs.readFileSync(this.statePath, 'utf-8');
    return JSON.parse(content);
  }

  save(state: OrchestratorState): void {
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  clear(): void {
    if (fs.existsSync(this.statePath)) {
      fs.unlinkSync(this.statePath);
    }
  }

  exists(): boolean {
    return fs.existsSync(this.statePath);
  }
}
