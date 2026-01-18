## Addendum: Robust Task Invocation & CLI Ergonomics (Required)

### Problem
Current worker invocation is brittle when task markdown includes:
- fenced code blocks (```),
- nested quotes,
- multi-line content,
- shell-special characters.

When the orchestrator passes the entire task content inline through a shell command (e.g., `codex exec "<content>"`)
and/or via tmux send-keys, tasks can fail due to shell escaping and quoting.

### Goals
1) Task files MUST support arbitrary Markdown, including code fences and quotes.
2) `codex-agent start` MUST be robust regardless of task file content.
3) Diagnostics MUST be ergonomic for supervisors (stable flags, predictable paths).
4) Orchestrator MUST be repo-root aware and resolve paths consistently.

### Requirements

#### R1. File-based task execution (no inline task content)
- `codex-agent start` MUST NOT embed task markdown content into a shell-quoted inline string.
- Instead, it MUST invoke Codex using a file-based or stdin-based method, such as:
  - `codex exec --file "<absolute_path_to_task_md>"` (preferred, if supported by Codex CLI), OR
  - `codex exec < "<absolute_path_to_task_md>"`, OR
  - `codex exec "$(cat "<absolute_path_to_task_md>")"` ONLY if the implementation applies a safe escaping strategy.
- The chosen method MUST preserve newlines and special characters safely.

Acceptance:
- A task file containing code fences and quotes runs without shell parsing errors.

#### R2. Repo-root canonicalization and path resolution
- All commands MUST detect the git repo root (`git rev-parse --show-toplevel`) and use it as the canonical base.
- Manifest `file` entries MUST be resolved relative to repo root when not absolute.
- Error messages MUST include:
  - the resolved repo root,
  - the resolved absolute task file path.

Acceptance:
- Running `codex-agent start --tasks .github/.../tasks.yaml` from any subdirectory works consistently.

#### R3. Manifest schema strictness + better errors
- Manifest schema MUST be documented and validated:
  - required: `tasks[].id`, `tasks[].file`
  - optional: `tasks[].description`, etc.
- If invalid, error must point to the exact task index and missing field.

Acceptance:
- Invalid manifests produce a single clear error with actionable guidance.

#### R4. `logs` command: add `--lines` option
- `codex-agent logs <worker-id>` MUST accept `--lines <n>` (alias `-n`) to limit captured output.

Acceptance:
- `codex-agent logs task-01 --lines 200` works.

#### R5. Do not require a clean working tree
- Uncommitted changes may trigger a warning, but MUST NOT make worktrees “read-only” or block execution.
- Any read-only behavior must be justified by a concrete error and surfaced in logs.

Acceptance:
- Orchestrator runs with a dirty working tree (warn-only).

#### R6. Observability: persist the exact worker command
- For each worker, write a file under run artifacts:
  - `workers/<id>/command.txt` containing the exact command executed in the tmux session.
- This is essential for debugging quoting issues.

Acceptance:
- After start, each worker has `command.txt`.

### Non-Goals
- No need to simplify user task markdown files.
- No requirement for users to avoid code fences or special characters in task files.
