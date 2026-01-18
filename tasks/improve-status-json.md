# Add JSON Output to Status Command

## Goal
Add a `--json` flag to the `codex-agent status` command that outputs machine-readable JSON instead of formatted text.

## Current Behavior
The `codex-agent status` command currently outputs human-readable formatted text showing worker information.

## Desired Behavior
When the `--json` flag is provided, the command should output a JSON array of worker metadata that can be easily parsed by scripts or other tools.

## Implementation Details

### File to Modify
- `src/commands/status.ts`

### Changes Needed
1. Add a `--json` option to the Commander.js command definition
2. Modify the status display logic to check if JSON output is requested
3. If `--json` is true, output `JSON.stringify()` of the worker data
4. If `--json` is false, keep the existing human-readable format

### Expected JSON Format
```json
[
  {
    "id": "task-id",
    "status": "running|completed|failed",
    "tmuxSession": "codex-orchastrator-task-id",
    "worktreePath": ".codex-agent/worktrees/task-id",
    "taskFile": "tasks/task-file.md"
  }
]
```

## Testing
1. Run `codex-agent status` - should show existing human-readable format
2. Run `codex-agent status --json` - should output valid JSON array
3. Verify the JSON can be parsed: `codex-agent status --json | jq .`

## Success Criteria
- The `--json` flag is recognized by the status command
- JSON output is valid and parseable
- Human-readable format still works when `--json` is not provided
- No breaking changes to existing functionality
