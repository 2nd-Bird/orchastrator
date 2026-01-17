#!/usr/bin/env node

import { Command } from 'commander';
import { validateRepo } from './utils/repo';
import { initCommand } from './commands/init';
import { startCommand } from './commands/start';
import { statusCommand } from './commands/status';
import { logsCommand } from './commands/logs';
import { diffCommand } from './commands/diff';
import { sendCommand } from './commands/send';
import { stopCommand } from './commands/stop';
import { cleanupCommand } from './commands/cleanup';

const program = new Command();

program
  .name('codex-agent')
  .description('A CLI tool to orchestrate multiple OpenAI Codex CLI workers')
  .version('1.0.0');

// Init command - doesn't require git validation
program
  .command('init')
  .description('Generate example task manifest and task files')
  .action(() => {
    const { repoRoot } = validateRepo();
    initCommand(repoRoot);
  });

// Start command
program
  .command('start')
  .description('Spawn workers in tmux sessions with git worktrees')
  .requiredOption('-t, --tasks <manifest>', 'Path to task manifest file')
  .action((options) => {
    const { repoRoot, repoName } = validateRepo();
    startCommand(repoRoot, repoName, options.tasks);
  });

// Status command
program
  .command('status')
  .description('Show worker status (all or specific)')
  .argument('[worker-id]', 'Worker ID (optional)')
  .action((workerId) => {
    const { repoRoot, repoName } = validateRepo();
    statusCommand(repoRoot, repoName, workerId);
  });

// Logs command
program
  .command('logs')
  .description('Capture recent tmux output from a worker')
  .argument('<worker-id>', 'Worker ID')
  .action((workerId) => {
    const { repoRoot, repoName } = validateRepo();
    logsCommand(repoRoot, repoName, workerId);
  });

// Diff command
program
  .command('diff')
  .description('Get diff or diffstat from a worker\'s worktree')
  .argument('<worker-id>', 'Worker ID')
  .option('--stat', 'Show only diff statistics')
  .action((workerId, options) => {
    const { repoRoot, repoName } = validateRepo();
    diffCommand(repoRoot, repoName, workerId, options.stat);
  });

// Send command
program
  .command('send')
  .description('Send additional instructions via tmux send-keys')
  .argument('<worker-id>', 'Worker ID')
  .argument('<instruction>', 'Instruction to send')
  .action((workerId, instruction) => {
    const { repoRoot, repoName } = validateRepo();
    sendCommand(repoRoot, repoName, workerId, instruction);
  });

// Stop command
program
  .command('stop')
  .description('Stop workers gracefully or forcefully')
  .argument('[worker-id]', 'Worker ID (optional, stops all if not provided)')
  .option('-f, --force', 'Force stop all workers')
  .action((workerId, options) => {
    const { repoRoot, repoName } = validateRepo();
    stopCommand(repoRoot, repoName, workerId, options.force);
  });

// Cleanup command
program
  .command('cleanup')
  .description('Remove tmux sessions and worktrees')
  .requiredOption('-f, --force', 'Force cleanup (required)')
  .action((options) => {
    const { repoRoot, repoName } = validateRepo();
    cleanupCommand(repoRoot, repoName, options.force);
  });

program.parse();
