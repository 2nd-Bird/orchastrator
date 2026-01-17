# codex-agent

A CLI tool that enables Claude Code to orchestrate multiple OpenAI Codex CLI workers in parallel using tmux and git worktrees.

## Goals

- **Parallel execution**: Run multiple Codex workers simultaneously, each in an isolated git worktree
- **Orchestrator control**: Provide Claude Code with commands to start, monitor, intervene, and collect results from workers
- **Scalable output**: Store large artifacts (diffs, logs) as files; keep JSON metadata lightweight
- **Safe operations**: Enforce safety constraints to prevent accidental damage to the repository or system

## Architecture Roles

| Component | Responsibility |
|-----------|----------------|
| **CLI (`codex-agent`)** | Entry point; parses commands and delegates to core modules |
| **WorkerManager** | Orchestrates worker lifecycle (start, monitor, stop) |
| **TmuxAdapter** | Creates/queries/kills tmux sessions; captures pane output; sends keystrokes |
| **WorktreeManager** | Creates/removes git worktrees; collects diffs |
| **TaskParser** | Parses YAML manifest and reads task markdown files |
| **StateStore** | Persists orchestrator state to `.codex-agent/state.json` |

## Core Principles

1. **File-based task delivery**: Task prompts live in markdown files; YAML manifest references them by path
2. **Artifact separation**: JSON contains metadata and paths; diffs/logs stored as files in run directory
3. **Per-worker intervention**: Every query/action can target a specific worker by ID
4. **Stat-first workflows**: Support `--stat` to preview diff statistics before fetching full diffs
5. **Minimal Codex invocation**: Use basic `codex exec` without speculative flags
6. **Idempotent state**: State file is source of truth; commands read state, perform action, update state

## Safety Constraints

### Destructive operations require `--force`
- `cleanup` always requires `--force`
- `stop` (all workers) requires `--force`

### Path containment
- Worktrees created only under `.codex-agent/worktrees/`
- Deletion operations validate paths are within allowed directories

### Session isolation
- Tmux sessions use strict naming: `codex-<reponame>-<taskid>`
- Only sessions matching the prefix are managed; others are never touched

### Repository validation
- Commands detect git repo root at startup; fail fast if not in a repo
- Warn (not block) if there are uncommitted changes

## Commands

| Command | Purpose |
|---------|---------|
| `init` | Generate example task manifest and task files |
| `start --tasks <manifest>` | Spawn workers in tmux sessions with git worktrees |
| `status [worker-id]` | Show worker status (all or specific) |
| `logs <worker-id>` | Capture recent tmux output from a worker |
| `diff <worker-id> [--stat]` | Get diff or diffstat from a worker's worktree |
| `send <worker-id> <instruction>` | Send additional instructions via tmux send-keys |
| `stop [worker-id] [--force]` | Stop workers gracefully or forcefully |
| `cleanup --force` | Remove tmux sessions and worktrees |

## Directory Layout

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
