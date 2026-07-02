/**
 * Benchmark CLI Command
 * 
 * Usage:
 *   grid dev bench live              # Live progressive benchmark with ASCII charts
 */

import { Command } from 'commander';
import { liveCommand } from './bench-live.js';

export const benchCommand = new Command('bench')
  .description('Run exchange benchmark')
  .addCommand(liveCommand);
