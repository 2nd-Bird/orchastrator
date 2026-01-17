# codex-agent

A CLI tool that enables Claude Code to orchestrate multiple OpenAI Codex CLI workers in parallel using tmux and git worktrees.

## Features

- **Parallel execution**: Run multiple Codex workers simultaneously in isolated git worktrees
- **Orchestrator control**: Start, monitor, intervene, and collect results from workers
- **Scalable output**: Store large artifacts (diffs, logs) as files with lightweight JSON metadata
- **Safe operations**: Safety constraints prevent accidental damage to repository or system

## Prerequisites

- Node.js 18+
- Git
- tmux
- OpenAI Codex CLI

## Installation

```bash
npm install
npm run build
npm link  # Optional: make codex-agent available globally
```

## Quick Start

1. Initialize the project (creates example tasks):
```bash
codex-agent init
```

2. Edit `tasks.yaml` and task files in `tasks/` directory

3. Start workers:
```bash
codex-agent start --tasks tasks.yaml
```

4. Monitor workers:
```bash
codex-agent status
codex-agent logs <worker-id>
codex-agent diff <worker-id> --stat
```

5. Cleanup when done:
```bash
codex-agent cleanup --force
```

## Commands

### `init`
Generate example task manifest and task files.

```bash
codex-agent init
```

### `start --tasks <manifest>`
Spawn workers in tmux sessions with git worktrees.

```bash
codex-agent start --tasks tasks.yaml
```

### `status [worker-id]`
Show worker status (all or specific).

```bash
codex-agent status           # All workers
codex-agent status task-1    # Specific worker
```

### `logs <worker-id>`
Capture recent tmux output from a worker.

```bash
codex-agent logs task-1
```

### `diff <worker-id> [--stat]`
Get diff or diffstat from a worker's worktree.

```bash
codex-agent diff task-1          # Full diff
codex-agent diff task-1 --stat   # Statistics only
```

### `send <worker-id> <instruction>`
Send additional instructions via tmux send-keys.

```bash
codex-agent send task-1 "Add unit tests"
```

### `stop [worker-id] [--force]`
Stop workers gracefully or forcefully.

```bash
codex-agent stop task-1          # Stop specific worker
codex-agent stop --force         # Stop all workers
```

### `cleanup --force`
Remove tmux sessions and worktrees.

```bash
codex-agent cleanup --force
```

## Task Manifest Format

The `tasks.yaml` manifest defines the tasks to execute:

```yaml
tasks:
  - id: task-1
    file: tasks/task-1-auth.md
    description: Add user authentication

  - id: task-2
    file: tasks/task-2-docs.md
    description: Create API documentation
```

Each task file contains markdown-formatted instructions for the Codex worker.

## Directory Structure

```
<repo>/
├── .codex-agent/
│   ├── state.json                 # Orchestrator state
│   ├── worktrees/<task-id>/       # Git worktrees (one per task)
│   └── runs/<run-id>/
│       ├── summary.json           # Run summary with artifact paths
│       └── workers/<task-id>/
│           ├── task.md            # Copy of task file
│           ├── logs.txt           # Captured output
│           ├── diff.patch         # Full diff
│           └── diffstat.txt       # Diff statistics
├── tasks/                         # User task files
│   └── *.md
└── tasks.yaml                     # Task manifest
```

## Safety Constraints

### Destructive operations require `--force`
- `cleanup` always requires `--force`
- `stop` (all workers) requires `--force`

### Path containment
- Worktrees created only under `.codex-agent/worktrees/`
- Deletion operations validate paths are within allowed directories

### Session isolation
- Tmux sessions use strict naming: `codex-<reponame>-<taskid>`
- Only sessions matching the prefix are managed

### Repository validation
- Commands detect git repo root at startup
- Warns (not blocks) if there are uncommitted changes

### Branch management
- Each worker gets a unique branch: `codex/<task-id>`
- Branches are created from current HEAD
- Cleanup deletes branches by default (use `--keep-branches` to preserve)

## Smoke Test

Quick end-to-end test to verify the tool works:

```bash
# 1. Initialize example tasks
codex-agent init

# 2. Start workers (spawns tmux sessions with git worktrees)
codex-agent start --tasks tasks.yaml

# 3. Check worker status (should show 2 workers running)
codex-agent status

# 4. View logs from a specific worker
codex-agent logs task-1

# 5. Check diff statistics
codex-agent diff task-1 --stat

# 6. View full diff
codex-agent diff task-1

# 7. Send additional instruction to a worker (optional)
codex-agent send task-1 "Add error handling"

# 8. Stop a specific worker (optional)
codex-agent stop task-1

# 9. Cleanup everything (removes tmux sessions, worktrees, and branches)
codex-agent cleanup --force
```

Expected behavior:
- `init` creates `tasks.yaml` and `tasks/` directory with example files
- `start` creates isolated worktrees in `.codex-agent/worktrees/<task-id>/` on branches `codex/<task-id>`
- `status` shows worker state with branch names
- `logs` displays recent tmux output
- `diff` shows changes made by the worker
- `cleanup` removes all worktrees, tmux sessions, and codex/* branches

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch

# Run in development
npm run dev -- <command>
```

## License

MIT
