/**
 * Tests for the embedding seam used by the private overlay, which registers its
 * own commands on top of the shared set instead of forking src/cli/index.ts.
 */

import { Command } from 'commander';
import { registerExtraCommands } from '../../../src/cli/extra-commands';

function buildBuiltins(): Command {
  const program = new Command();
  const dev = new Command('dev');
  dev.addCommand(new Command('bench'));
  dev.addCommand(new Command('setup'));
  program.addCommand(dev);
  program.addCommand(new Command('order'));
  return program;
}

describe('registerExtraCommands', () => {
  it('appends a command whose name is not already taken', () => {
    const program = buildBuiltins();

    registerExtraCommands(program, [new Command('ui')]);

    expect(program.commands.map((c) => c.name())).toEqual(['dev', 'order', 'ui']);
  });

  it('merges into a built-in group of the same name instead of duplicating it', () => {
    const program = buildBuiltins();
    const overlayDev = new Command('dev');
    overlayDev.addCommand(new Command('present'));

    registerExtraCommands(program, [overlayDev]);

    expect(program.commands.filter((c) => c.name() === 'dev')).toHaveLength(1);
  });

  it('keeps both built-in and overlay subcommands reachable after a merge', () => {
    const program = buildBuiltins();
    const overlayDev = new Command('dev');
    overlayDev.addCommand(new Command('present'));

    registerExtraCommands(program, [overlayDev]);
    const dev = program.commands.find((c) => c.name() === 'dev');

    // Commander resolves a name to the first matching command, so a duplicate
    // group would leave one set of subcommands permanently unreachable.
    expect(dev?.commands.map((c) => c.name())).toEqual(['bench', 'setup', 'present']);
  });

  it('handles a mix of merged and appended commands', () => {
    const program = buildBuiltins();
    const overlayDev = new Command('dev');
    overlayDev.addCommand(new Command('present'));

    registerExtraCommands(program, [overlayDev, new Command('ui')]);

    expect(program.commands.map((c) => c.name())).toEqual(['dev', 'order', 'ui']);
    const dev = program.commands.find((c) => c.name() === 'dev');
    expect(dev?.commands.map((c) => c.name())).toContain('present');
  });

  it('is a no-op when no extra commands are supplied', () => {
    const program = buildBuiltins();

    registerExtraCommands(program, []);

    expect(program.commands.map((c) => c.name())).toEqual(['dev', 'order']);
  });
});
