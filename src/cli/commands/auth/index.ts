import { Command } from 'commander';
import { authStatusCommand } from './status';
import { authLoginCommand } from './login';
import { authLogoutCommand } from './logout';

export const authCommand = new Command('auth')
  .description('Manage authentication and credentials')
  .addCommand(authStatusCommand)
  .addCommand(authLoginCommand)
  .addCommand(authLogoutCommand);
