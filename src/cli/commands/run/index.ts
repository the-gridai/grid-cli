import { Command } from 'commander';
import { runCommand } from './run';

export const runCommandGroup = new Command('run')
  .description('Run AI inference with Open Responses spec (agentic-first)')
  .argument('[prompt]', 'Initial prompt to start the conversation')
  .option('-m, --model <model>', 'Model ID to use')
  .option('-i, --instructions <text>', 'System instructions')
  .option('--turns <n>', 'Max turns for agentic loop (default: unlimited, 1 for single-turn)')
  .option('--tools <tools>', 'Enable tools (comma-separated or "all")')
  .option('--no-stream', 'Disable streaming output')
  .option('--print', 'Non-interactive mode (print response and exit)')
  .option('--temperature <n>', 'Temperature for sampling (0-2)')
  .option('--max-tokens <n>', 'Maximum tokens per response')
  .option('--save <file>', 'Save session to file')
  .option('--resume <file>', 'Resume previous session from file')
  .action(runCommand);

export { runCommand };
