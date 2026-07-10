import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { App } from '../../ui/tui';
import { loadConfig } from '../../../core/config/config';
import { interactiveTerminalProblem } from '../../utils/tty';
import chalk from 'chalk';

/**
 * Check if the terminal supports interactive mode (TTY with raw mode)
 */
function checkTTYSupport(): boolean {
  const problem = interactiveTerminalProblem();

  if (problem) {
    console.error(chalk.yellow('⚠ Interactive mode requires a TTY terminal.'));
    console.error(chalk.dim(`  ${problem}. Run this command in an interactive terminal, not through pipes or scripts.`));
    console.error('');
    console.error(chalk.dim('  Alternatively, use standard CLI commands:'));
    console.error(chalk.cyan('    grid status') + chalk.dim('        - View system status'));
    console.error(chalk.cyan('    grid account balance') + chalk.dim(' - View balances'));
    console.error(chalk.cyan('    grid order list') + chalk.dim('      - View orders'));
    return false;
  }
  return true;
}

export const tuiCommand = new Command('tui')
  .description('Launch interactive terminal UI')
  .action(async () => {
    if (!checkTTYSupport()) {
      process.exit(1);
    }
    
    // Ensure config is loaded
    loadConfig();
    
    // Render the TUI app
    const { waitUntilExit, clear } = render(<App />, {
      exitOnCtrlC: false, // We handle Ctrl+C ourselves
    });
    
    await waitUntilExit();
    clear();
  });

/**
 * Launch the TUI directly (for use with grid --interactive or grid without args)
 */
export async function launchTUI(): Promise<void> {
  if (!checkTTYSupport()) {
    process.exit(1);
  }
  
  loadConfig();
  
  const { waitUntilExit, clear } = render(<App />, {
    exitOnCtrlC: false,
  });
  
  await waitUntilExit();
  clear();
}
