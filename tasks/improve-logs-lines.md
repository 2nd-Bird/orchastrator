# Add Line Limit to Logs Command

## Goal
Add a `--lines N` flag to the `codex-agent logs` command to control how many lines of output are captured from the tmux session.

## Current Behavior
The `codex-agent logs <worker-id>` command captures tmux output, but there's no way to limit how many lines are returned.

## Desired Behavior
When the `--lines N` flag is provided, the command should capture only the last N lines from the tmux session, similar to `tail -n N`.

## Implementation Details

### File to Modify
- `src/commands/logs.ts`

### Changes Needed
1. Add a `--lines <number>` option to the Commander.js command definition
2. Pass the lines parameter to the TmuxAdapter when capturing pane output
3. Modify the TmuxAdapter's capture method to accept an optional lines parameter
4. Use tmux's `-p` flag with appropriate line count when capturing

### Tmux Command Reference
The tmux `capture-pane` command supports controlling output:
- `tmux capture-pane -p` - capture entire pane
- `tmux capture-pane -p -S -N` - capture last N lines (where N is a number)

### Expected Behavior Examples
```bash
# Capture all output (current behavior)
codex-agent logs improve-status-json

# Capture last 50 lines
codex-agent logs improve-status-json --lines 50

# Capture last 10 lines
codex-agent logs improve-status-json --lines 10
```

## Testing
1. Run `codex-agent logs <worker-id>` - should show all output (existing behavior)
2. Run `codex-agent logs <worker-id> --lines 50` - should show only last 50 lines
3. Run `codex-agent logs <worker-id> --lines 10` - should show only last 10 lines
4. Verify line count is accurate with `codex-agent logs <worker-id> --lines 10 | wc -l`

## Success Criteria
- The `--lines` flag is recognized by the logs command
- Specifying `--lines N` returns exactly N lines (or fewer if less output exists)
- Omitting `--lines` preserves existing behavior (all output)
- No breaking changes to existing functionality
