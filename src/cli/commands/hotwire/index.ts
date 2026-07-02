/**
 * HOTWIRE Command - Grid Intelligence Interface
 * 
 * Direct access to the intelligence market from your terminal
 */

import { Command } from 'commander';
import { hotwireCommand } from './hotwire';

export const hotwireCommandGroup = new Command('hotwire')
  .description('Launch HOTWIRE - Intelligence interface')
  .argument('[prompt]', 'Your question or task')
  .option('-s, --spec <spec>', 'Inference spec (e.g., fast-inference, prime-inference)')
  .option('-i, --instructions <text>', 'System instructions')
  .option('--turns <n>', 'Maximum conversation turns')
  .option('--temperature <n>', 'Response creativity (0-2)')
  .option('--max-tokens <n>', 'Maximum response tokens')
  .option('--stream', 'Stream response tokens (default: true)')
  .option('--no-stream', 'Disable streaming')
  .option('--save <file>', 'Save session to file')
  .option('--resume <file>', 'Resume session from file')
  .option('--auto-fund', 'Automatically transfer credits from trading account when balance is low')
  .option('--auto-fund-amount <n>', 'Amount to transfer when auto-funding (default: 1000)', '1000')
  .action(hotwireCommand);
