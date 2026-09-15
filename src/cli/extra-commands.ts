/**
 * Registration rules for commands supplied by an embedding overlay.
 *
 * Kept in its own module so it can be unit-tested without importing the whole
 * command tree, which pulls in ink and is ESM-only.
 */
import type { Command } from 'commander';

/**
 * Register overlay-supplied commands onto the root program.
 *
 * An extra command whose name matches a built-in group contributes its
 * subcommands to that group rather than being added alongside it. Commander
 * resolves a name to the first matching command, so a second `dev` would leave
 * one set of subcommands permanently unreachable.
 */
export function registerExtraCommands(program: Command, extraCommands: Command[]): void {
  for (const command of extraCommands) {
    const existing = program.commands.find((c) => c.name() === command.name());
    if (existing) {
      for (const subcommand of command.commands) {
        existing.addCommand(subcommand);
      }
    } else {
      program.addCommand(command);
    }
  }
}
