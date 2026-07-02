import { Command } from 'commander';
import { profileListCommand } from './list';
import { profileShowCommand } from './show';
import { profileSetCommand } from './set';
import { profileDeleteCommand } from './delete';
import { profileUseCommand } from './use';

export const profileCommand = new Command('profile')
  .description('Manage credential profiles')
  .addCommand(profileListCommand)
  .addCommand(profileShowCommand)
  .addCommand(profileSetCommand)
  .addCommand(profileDeleteCommand)
  .addCommand(profileUseCommand);
