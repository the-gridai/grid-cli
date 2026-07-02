#!/usr/bin/env node
/**
 * GRID CLI Entry Point
 *
 * OpenTelemetry instrumentation is handled by `src/instrumentation.ts`,
 * loaded via the Node.js `--import` flag in the bin/grid shim. By the time
 * this file runs, HTTP auto-instrumentation is already active and every
 * outgoing request automatically gets W3C traceparent propagation.
 *
 * This file uses ONLY `@opentelemetry/api` — no SDK imports.
 */
import { Command } from 'commander';
import { statusCommand } from './commands/system/status';
import { startCommand } from './commands/system/start';
import { orderCommand } from './commands/order';
import { accountCommand } from './commands/account';
import { strategyCommand } from './commands/strategies';
import { supplyCommand } from './commands/supply';
import { daemonCommand } from './commands/daemon/start';
import { profileCommand } from './commands/profile';
import { authCommand } from './commands/auth';
import { devCommand } from './commands/dev';
import { tuiCommand, launchTUI } from './commands/tui';
import { hotwireCommandGroup } from './commands/hotwire';
import { consumptionCommandGroup } from './commands/consumption';
import { tradingCommandGroup } from './commands/trading';
import { uiCommand } from './commands/ui';
import { configCommand } from './commands/config';
import { loadConfig } from '../core/config/config';
import { setGlobalProfileOverride } from '../core/config/profiles';
import { getVersion } from '../core/version';
import { logger } from '../core/logging/logger';
import { setTimingEnabled, getLastRequestTiming, formatTiming } from '../sdk/http/timing';
import chalk from 'chalk';

let showTiming = false;

const main = async () => {
  const program = new Command();

  program
    .name('grid')
    .description('GRID Exchange CLI - Trading & Automation Terminal')
    .version(getVersion())
    .option('-p, --profile <name>', 'Use a specific credential profile')
    .option('-t, --timing', 'Show request timing breakdown')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.profile) {
        setGlobalProfileOverride(opts.profile);
      }
      if (opts.timing) {
        showTiming = true;
        setTimingEnabled(true);
      }
      loadConfig();
    })
    .hook('postAction', () => {
      if (showTiming) {
        const timing = getLastRequestTiming();
        if (timing) {
          console.log(chalk.gray(formatTiming(timing)));
        }
      }
    });

  program.addCommand(statusCommand);
  program.addCommand(startCommand);
  program.addCommand(orderCommand);
  program.addCommand(accountCommand);
  program.addCommand(strategyCommand);
  program.addCommand(supplyCommand);
  program.addCommand(daemonCommand);
  program.addCommand(profileCommand);
  program.addCommand(authCommand);
  program.addCommand(devCommand);
  program.addCommand(tuiCommand);
  program.addCommand(hotwireCommandGroup);
  program.addCommand(consumptionCommandGroup);
  program.addCommand(tradingCommandGroup);
  program.addCommand(uiCommand);
  program.addCommand(configCommand);

  program.on('command:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
  });

  const args = process.argv.slice(2);

  const filteredArgs = [...args];
  const profileIdx = filteredArgs.indexOf('-p') !== -1 ? filteredArgs.indexOf('-p') : filteredArgs.indexOf('--profile');
  if (profileIdx !== -1) {
    filteredArgs.splice(profileIdx, 2);
  }
  const timingIdx = filteredArgs.indexOf('-t') !== -1 ? filteredArgs.indexOf('-t') : filteredArgs.indexOf('--timing');
  if (timingIdx !== -1) {
    filteredArgs.splice(timingIdx, 1);
  }

  const firstArg = filteredArgs.find(a => !a.startsWith('-'));
  const hasSubcommand = !!firstArg;

  if (!hasSubcommand && filteredArgs.length === 0) {
    if (profileIdx !== -1 && args[profileIdx + 1]) {
      setGlobalProfileOverride(args[profileIdx + 1]);
    }
    loadConfig();
    await launchTUI();
    return;
  }

  await program.parseAsync(process.argv);
};

main().catch(async (err) => {
  logger.error('Fatal Error:', { error: err });
  console.error(chalk.red('Fatal Error:'), err);
  process.exit(1);
});
