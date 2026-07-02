import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { getActiveProfileName } from '../../../core/config/profiles';
import { AuthLogoutView } from '../../ui/views/AuthLogoutView';

export const authLogoutCommand = new Command('logout')
  .description('Log out and revoke OAuth tokens for a profile')
  .option('-p, --profile <name>', 'Profile to log out of')
  .option('--delete', 'Delete the profile entirely after logout', false)
  .action(async (options: { profile?: string; delete: boolean }) => {
    const profileName = options.profile || getActiveProfileName() || 'default';

    const { waitUntilExit } = render(
      <AuthLogoutView profileName={profileName} deleteAfter={options.delete} />
    );

    await waitUntilExit();
  });
